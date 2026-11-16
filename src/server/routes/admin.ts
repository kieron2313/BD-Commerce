import { Router, Response } from 'express';
import { db } from '../../db/index.ts';
import {
  products,
  productCategories,
  productVariations,
  variationAttributeValues,
  categories,
  brands,
  attributes,
  attributeValues,
  inventoryLogs,
  orders,
  orderItems,
  orderHistory,
  inquiries,
  inquiryItems,
  quotations,
  quotationItems,
  customers,
  coupons,
  couponUsage,
  shippingZones,
  shippingMethods,
  mediaLibrary,
  seoMetadata,
  urlRedirects,
  websitePages,
  emailTemplates,
  notifications,
  users,
  roles,
  permissions,
  settings,
} from '../../db/schema.ts';
import { eq, desc, asc, inArray, sql } from 'drizzle-orm';
import { requireAuth, requirePermission, AuthRequest } from '../../middleware/auth.ts';
import {
  getAllSettings,
  adjustStockAndLog,
  dispatchNotification,
  generateUniqueRef,
  generateSecureToken,
  recalculateAndSaveQuotationTotals,
  convertQuotationToOrder,
  roundMoney,
} from '../../services/platform.ts';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();
router.use(requireAuth);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// 1. DASHBOARD OVERVIEW
// ============================================================================

router.get('/overview', requirePermission('dashboard', 'canView'), async (_req: AuthRequest, res: Response) => {
  try {
    const allSettings = await getAllSettings();
    const [
      prodCount,
      catCount,
      custCount,
      orderRows,
      inquiryRows,
      quoteRows,
      lowStockProds,
      lowStockVars,
    ] = await Promise.all([
      db.select({ total: sql<number>`count(*)::int` }).from(products),
      db.select({ total: sql<number>`count(*)::int` }).from(categories),
      db.select({ total: sql<number>`count(*)::int` }).from(customers),
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(inquiries).orderBy(desc(inquiries.createdAt)),
      db.select().from(quotations).orderBy(desc(quotations.createdAt)),
      db.select().from(products).where(sql`${products.stockQuantity} <= 5 AND ${products.productType} = 'simple'`),
      db.select().from(productVariations).where(sql`${productVariations.stockQuantity} <= 5`),
    ]);

    const threshold = Number(allSettings.commerce?.lowStockThreshold ?? 5);
    const pendingOrders = orderRows.filter((o) => o.orderStatus === 'pending').length;
    const newInquiries = inquiryRows.filter((i) => i.status === 'new').length;
    const totalSales = roundMoney(
      orderRows
        .filter((o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'refunded')
        .reduce((acc, o) => acc + (o.totalAmount || 0), 0)
    );

    res.json({
      operatingMode: allSettings.commerce?.operatingMode || 'ecommerce',
      stats: {
        totalProducts: prodCount[0]?.total ?? 0,
        totalCategories: catCount[0]?.total ?? 0,
        totalCustomers: custCount[0]?.total ?? 0,
        totalOrders: orderRows.length,
        totalInquiries: inquiryRows.length,
        totalQuotations: quoteRows.length,
        pendingOrders,
        newInquiries,
        lowStockCount: lowStockProds.length + lowStockVars.length,
        lowStockThreshold: threshold,
        totalSales,
      },
      recentOrders: orderRows.slice(0, 6),
      recentInquiries: inquiryRows.slice(0, 6),
      recentQuotations: quoteRows.slice(0, 6),
      lowStockItems: [
        ...lowStockProds.map((p) => ({
          type: 'product',
          id: p.id,
          name: p.name,
          sku: p.sku,
          stockQuantity: p.stockQuantity,
        })),
        ...lowStockVars.map((v) => ({
          type: 'variation',
          id: v.id,
          productId: v.productId,
          name: v.attributes?.map((a) => a.value).join(' · ') || v.sku,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
        })),
      ].slice(0, 10),
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to load dashboard overview.' });
  }
});

// ============================================================================
// 2. PRODUCTS CRUD, DUPLICATION & VARIATION GENERATOR
// ============================================================================

router.get('/products', requirePermission('products', 'canView'), async (_req: AuthRequest, res: Response) => {
  try {
    const prods = await db.select().from(products).orderBy(desc(products.id));
    const catLinks = await db.select().from(productCategories);
    const vars = await db.select().from(productVariations);
    const enriched = prods.map((p) => ({
      ...p,
      categoryIds: catLinks.filter((l) => l.productId === p.id).map((l) => l.categoryId),
      variations: vars.filter((v) => v.productId === p.id),
    }));
    res.json({ products: enriched });
  } catch (error) {
    console.error('Admin products list error:', error);
    res.status(500).json({ error: 'Failed to load products.' });
  }
});

router.post('/products', requirePermission('products', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;
    const slug = slugify(data.slug || data.name);
    const sku = (data.sku || `KA-${Date.now().toString().slice(-6)}`).trim();

    const [created] = await db
      .insert(products)
      .values({
        name: data.name,
        sku,
        slug,
        shortDescription: data.shortDescription || '',
        fullDescription: data.fullDescription || '',
        mainImageUrl: data.mainImageUrl || '',
        galleryImages: data.galleryImages || [],
        imageAlt: data.imageAlt || data.name,
        brandId: data.brandId ? Number(data.brandId) : null,
        tags: data.tags || [],
        status: data.status || 'published',
        isFeatured: Boolean(data.isFeatured),
        isNew: Boolean(data.isNew),
        specifications: data.specifications || [],
        relatedProductIds: data.relatedProductIds || [],
        crossSellProductIds: data.crossSellProductIds || [],
        upsellProductIds: data.upsellProductIds || [],
        productType: data.productType || 'simple',
        regularPrice: Number(data.regularPrice) || 0,
        salePrice: data.salePrice !== null && data.salePrice !== '' && data.salePrice !== undefined ? Number(data.salePrice) : null,
        saleStartDate: data.saleStartDate ? new Date(data.saleStartDate) : null,
        saleEndDate: data.saleEndDate ? new Date(data.saleEndDate) : null,
        costPrice: Number(data.costPrice) || 0,
        taxClass: data.taxClass || 'standard',
        stockQuantity: Number(data.stockQuantity) || 0,
        stockStatus: data.stockStatus || 'in_stock',
        allowBackorder: Boolean(data.allowBackorder),
        minOrderQty: Math.max(1, Number(data.minOrderQty) || 1),
        maxOrderQty: data.maxOrderQty ? Number(data.maxOrderQty) : null,
        weight: Number(data.weight) || 0,
        dimensions: data.dimensions || { length: 0, width: 0, height: 0, unit: 'cm' },
        priceVisibility: data.priceVisibility || 'inherit',
        salePriceVisibility: data.salePriceVisibility || 'inherit',
        stockVisibility: data.stockVisibility || 'inherit',
        skuVisibility: data.skuVisibility || 'inherit',
        inquiryEnabled: data.inquiryEnabled || 'inherit',
        quantityEnabled: data.quantityEnabled || 'inherit',
        quoteEnabled: data.quoteEnabled || 'inherit',
        seoTitle: data.seoTitle || '',
        metaDescription: data.metaDescription || '',
        canonicalUrl: data.canonicalUrl || '',
        assignedAttributes: data.assignedAttributes || [],
      })
      .returning();

    if (Array.isArray(data.categoryIds) && data.categoryIds.length > 0) {
      await db.insert(productCategories).values(
        data.categoryIds.map((cid: number, idx: number) => ({
          productId: created.id,
          categoryId: Number(cid),
          isPrimary: idx === 0,
        }))
      );
    }

    res.status(201).json({ product: created });
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(400).json({ error: error.message || 'Failed to create product. Check unique SKU/slug.' });
  }
});

router.put('/products/:id', requirePermission('products', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = req.body;
    const existing = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (existing.length === 0) return res.status(404).json({ error: 'Product not found.' });

    const newSlug = slugify(data.slug || data.name || existing[0].slug);
    // Automatic 301 redirect if slug changes
    if (existing[0].slug !== newSlug) {
      await db
        .insert(urlRedirects)
        .values({
          sourcePath: `/products/${existing[0].slug}`,
          targetPath: `/products/${newSlug}`,
          statusCode: 301,
          isActive: true,
        })
        .onConflictDoNothing();
    }

    const [updated] = await db
      .update(products)
      .set({
        name: data.name ?? existing[0].name,
        sku: data.sku ?? existing[0].sku,
        slug: newSlug,
        shortDescription: data.shortDescription ?? existing[0].shortDescription,
        fullDescription: data.fullDescription ?? existing[0].fullDescription,
        mainImageUrl: data.mainImageUrl ?? existing[0].mainImageUrl,
        galleryImages: data.galleryImages ?? existing[0].galleryImages,
        imageAlt: data.imageAlt ?? existing[0].imageAlt,
        brandId: data.brandId !== undefined ? (data.brandId ? Number(data.brandId) : null) : existing[0].brandId,
        tags: data.tags ?? existing[0].tags,
        status: data.status ?? existing[0].status,
        isFeatured: data.isFeatured !== undefined ? Boolean(data.isFeatured) : existing[0].isFeatured,
        isNew: data.isNew !== undefined ? Boolean(data.isNew) : existing[0].isNew,
        specifications: data.specifications ?? existing[0].specifications,
        relatedProductIds: data.relatedProductIds ?? existing[0].relatedProductIds,
        crossSellProductIds: data.crossSellProductIds ?? existing[0].crossSellProductIds,
        upsellProductIds: data.upsellProductIds ?? existing[0].upsellProductIds,
        productType: data.productType ?? existing[0].productType,
        regularPrice: data.regularPrice !== undefined ? Number(data.regularPrice) : existing[0].regularPrice,
        salePrice:
          data.salePrice !== undefined
            ? data.salePrice !== null && data.salePrice !== ''
              ? Number(data.salePrice)
              : null
            : existing[0].salePrice,
        saleStartDate: data.saleStartDate ? new Date(data.saleStartDate) : data.saleStartDate === null ? null : existing[0].saleStartDate,
        saleEndDate: data.saleEndDate ? new Date(data.saleEndDate) : data.saleEndDate === null ? null : existing[0].saleEndDate,
        costPrice: data.costPrice !== undefined ? Number(data.costPrice) : existing[0].costPrice,
        taxClass: data.taxClass ?? existing[0].taxClass,
        stockQuantity: data.stockQuantity !== undefined ? Number(data.stockQuantity) : existing[0].stockQuantity,
        stockStatus: data.stockStatus ?? existing[0].stockStatus,
        allowBackorder: data.allowBackorder !== undefined ? Boolean(data.allowBackorder) : existing[0].allowBackorder,
        minOrderQty: data.minOrderQty !== undefined ? Math.max(1, Number(data.minOrderQty)) : existing[0].minOrderQty,
        maxOrderQty: data.maxOrderQty !== undefined ? (data.maxOrderQty ? Number(data.maxOrderQty) : null) : existing[0].maxOrderQty,
        weight: data.weight !== undefined ? Number(data.weight) : existing[0].weight,
        dimensions: data.dimensions ?? existing[0].dimensions,
        priceVisibility: data.priceVisibility ?? existing[0].priceVisibility,
        salePriceVisibility: data.salePriceVisibility ?? existing[0].salePriceVisibility,
        stockVisibility: data.stockVisibility ?? existing[0].stockVisibility,
        skuVisibility: data.skuVisibility ?? existing[0].skuVisibility,
        inquiryEnabled: data.inquiryEnabled ?? existing[0].inquiryEnabled,
        quantityEnabled: data.quantityEnabled ?? existing[0].quantityEnabled,
        quoteEnabled: data.quoteEnabled ?? existing[0].quoteEnabled,
        seoTitle: data.seoTitle ?? existing[0].seoTitle,
        metaDescription: data.metaDescription ?? existing[0].metaDescription,
        canonicalUrl: data.canonicalUrl ?? existing[0].canonicalUrl,
        assignedAttributes: data.assignedAttributes ?? existing[0].assignedAttributes,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    if (Array.isArray(data.categoryIds)) {
      await db.delete(productCategories).where(eq(productCategories.productId, id));
      if (data.categoryIds.length > 0) {
        await db.insert(productCategories).values(
          data.categoryIds.map((cid: number, idx: number) => ({
            productId: id,
            categoryId: Number(cid),
            isPrimary: idx === 0,
          }))
        );
      }
    }

    res.json({ product: updated });
  } catch (error: any) {
    console.error('Update product error:', error);
    res.status(400).json({ error: error.message || 'Failed to update product.' });
  }
});

router.post('/products/:id/duplicate', requirePermission('products', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (existing.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const src = existing[0];
    const suffix = Date.now().toString().slice(-4);
    const [dup] = await db
      .insert(products)
      .values({
        ...src,
        id: undefined,
        name: `${src.name} (Copy)`,
        sku: `${src.sku}-COPY-${suffix}`,
        slug: `${src.slug}-copy-${suffix}`,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const cats = await db.select().from(productCategories).where(eq(productCategories.productId, id));
    if (cats.length > 0) {
      await db.insert(productCategories).values(
        cats.map((c) => ({ productId: dup.id, categoryId: c.categoryId, isPrimary: c.isPrimary }))
      );
    }

    const vars = await db.select().from(productVariations).where(eq(productVariations.productId, id));
    for (const v of vars) {
      await db.insert(productVariations).values({
        ...v,
        id: undefined,
        productId: dup.id,
        sku: `${v.sku}-COPY-${suffix}`,
        createdAt: new Date(),
      });
    }

    res.status(201).json({ product: dup });
  } catch (error) {
    console.error('Duplicate product error:', error);
    res.status(500).json({ error: 'Failed to duplicate product.' });
  }
});

router.post('/products/bulk-status', requirePermission('products', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { productIds, status } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'No products selected.' });
    }
    await db
      .update(products)
      .set({ status, updatedAt: new Date() })
      .where(inArray(products.id, productIds.map(Number)));
    res.json({ updated: productIds.length });
  } catch (error) {
    console.error('Bulk status error:', error);
    res.status(500).json({ error: 'Failed bulk update.' });
  }
});

router.delete('/products/:id', requirePermission('products', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    await db.delete(products).where(eq(products.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// ============================================================================
// 3. VARIATIONS & WOOCOMMERCE-STYLE AUTO COMBINATION GENERATOR
// ============================================================================

router.get('/variations', requirePermission('variations', 'canView'), async (_req: AuthRequest, res: Response) => {
  try {
    const vars = await db.select().from(productVariations).orderBy(desc(productVariations.id));
    const prods = await db.select({ id: products.id, name: products.name, sku: products.sku }).from(products);
    const prodMap = new Map(prods.map((p) => [p.id, p]));
    res.json({
      variations: vars.map((v) => ({
        ...v,
        productName: prodMap.get(v.productId)?.name || 'Unknown Product',
      })),
    });
  } catch (error) {
    console.error('Admin variations error:', error);
    res.status(500).json({ error: 'Failed to fetch variations.' });
  }
});

router.post('/products/:id/variations/generate', requirePermission('variations', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const productId = Number(req.params.id);
    const prodRows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (prodRows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const prod = prodRows[0];

    const assigned = (req.body.assignedAttributes || prod.assignedAttributes || []).filter(
      (a: any) => a.usedForVariations && Array.isArray(a.valueIds) && a.valueIds.length > 0
    );
    if (assigned.length === 0) {
      return res.status(400).json({ error: 'Assign at least one variation attribute with values first.' });
    }

    const allAttrs = await db.select().from(attributes);
    const allVals = await db.select().from(attributeValues);

    const groups = assigned.map((a: any) => {
      const attr = allAttrs.find((x) => x.id === Number(a.attributeId));
      return a.valueIds
        .map((vid: number) => {
          const val = allVals.find((v) => v.id === Number(vid));
          if (!attr || !val) return null;
          return {
            attributeId: attr.id,
            attributeName: attr.name,
            attributeSlug: attr.slug,
            valueId: val.id,
            value: val.value,
            colorHex: val.colorHex || '',
          };
        })
        .filter(Boolean);
    });

    // Cartesian product
    const cartesian = (arrays: any[][]): any[][] =>
      arrays.reduce((acc, curr) => acc.flatMap((d) => curr.map((e) => [...d, e])), [[]]);

    const combos = cartesian(groups);
    const existingVars = await db
      .select()
      .from(productVariations)
      .where(eq(productVariations.productId, productId));

    const existingKeys = new Set(
      existingVars.map((v) =>
        (v.attributes || [])
          .map((a) => `${a.attributeId}:${a.valueId}`)
          .sort()
          .join('|')
      )
    );

    const created: Array<typeof productVariations.$inferSelect> = [];
    for (const combo of combos) {
      const key = combo
        .map((a: any) => `${a.attributeId}:${a.valueId}`)
        .sort()
        .join('|');
      if (existingKeys.has(key)) continue;

      const suffix = combo
        .map((a: any) => a.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase())
        .join('-');
      let candidateSku = `${prod.sku}-${suffix}`;
      const dupCheck = await db
        .select({ id: productVariations.id })
        .from(productVariations)
        .where(eq(productVariations.sku, candidateSku))
        .limit(1);
      if (dupCheck.length > 0) {
        candidateSku = `${candidateSku}-${Math.floor(10 + Math.random() * 89)}`;
      }

      const [newVar] = await db
        .insert(productVariations)
        .values({
          productId,
          sku: candidateSku,
          regularPrice: prod.regularPrice,
          salePrice: prod.salePrice,
          stockQuantity: prod.stockQuantity || 10,
          stockStatus: 'in_stock',
          imageUrl: prod.mainImageUrl || '',
          weight: prod.weight || 0,
          dimensions: prod.dimensions,
          isEnabled: true,
          attributes: combo,
        })
        .returning();

      for (const attrItem of combo) {
        await db.insert(variationAttributeValues).values({
          variationId: newVar.id,
          attributeId: attrItem.attributeId,
          attributeValueId: attrItem.valueId,
        });
      }
      created.push(newVar);
    }

    if (prod.productType !== 'variable') {
      await db.update(products).set({ productType: 'variable', assignedAttributes: assigned }).where(eq(products.id, productId));
    }

    const allProductVars = await db
      .select()
      .from(productVariations)
      .where(eq(productVariations.productId, productId))
      .orderBy(asc(productVariations.id));

    res.json({ createdCount: created.length, variations: allProductVars });
  } catch (error) {
    console.error('Generate variations error:', error);
    res.status(500).json({ error: 'Failed to generate variation combinations.' });
  }
});

router.put('/variations/:id', requirePermission('variations', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = req.body;
    const [updated] = await db
      .update(productVariations)
      .set({
        sku: data.sku,
        regularPrice: Number(data.regularPrice) || 0,
        salePrice: data.salePrice !== null && data.salePrice !== '' && data.salePrice !== undefined ? Number(data.salePrice) : null,
        stockQuantity: Number(data.stockQuantity) || 0,
        stockStatus: data.stockStatus || (Number(data.stockQuantity) > 0 ? 'in_stock' : 'out_of_stock'),
        backorderStatus: data.backorderStatus || 'no',
        imageUrl: data.imageUrl || '',
        weight: Number(data.weight) || 0,
        dimensions: data.dimensions,
        isEnabled: data.isEnabled !== undefined ? Boolean(data.isEnabled) : true,
      })
      .where(eq(productVariations.id, id))
      .returning();
    res.json({ variation: updated });
  } catch (error: any) {
    console.error('Update variation error:', error);
    res.status(400).json({ error: error.message || 'Failed to update variation.' });
  }
});

router.post('/variations/bulk-edit', requirePermission('variations', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { variationIds, regularPrice, salePrice, stockQuantity, isEnabled } = req.body;
    if (!Array.isArray(variationIds) || variationIds.length === 0) {
      return res.status(400).json({ error: 'No variations selected.' });
    }
    const patch: Record<string, unknown> = {};
    if (regularPrice !== undefined && regularPrice !== '') patch.regularPrice = Number(regularPrice);
    if (salePrice !== undefined) patch.salePrice = salePrice === '' || salePrice === null ? null : Number(salePrice);
    if (stockQuantity !== undefined && stockQuantity !== '') {
      patch.stockQuantity = Number(stockQuantity);
      patch.stockStatus = Number(stockQuantity) > 0 ? 'in_stock' : 'out_of_stock';
    }
    if (isEnabled !== undefined) patch.isEnabled = Boolean(isEnabled);

    await db
      .update(productVariations)
      .set(patch)
      .where(inArray(productVariations.id, variationIds.map(Number)));
    res.json({ updated: variationIds.length });
  } catch (error) {
    console.error('Bulk variation edit error:', error);
    res.status(500).json({ error: 'Failed bulk variation edit.' });
  }
});

router.delete('/variations/:id', requirePermission('variations', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    await db.delete(productVariations).where(eq(productVariations.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete variation error:', error);
    res.status(500).json({ error: 'Failed to delete variation.' });
  }
});

// ============================================================================
// 4. CATEGORIES, BRANDS, ATTRIBUTES, INVENTORY
// ============================================================================

router.get('/categories', requirePermission('categories', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  res.json({ categories: rows });
});

router.post('/categories', requirePermission('categories', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [created] = await db
      .insert(categories)
      .values({
        parentId: d.parentId ? Number(d.parentId) : null,
        name: d.name,
        slug: slugify(d.slug || d.name),
        description: d.description || '',
        imageUrl: d.imageUrl || '',
        icon: d.icon || '',
        seoTitle: d.seoTitle || '',
        seoDescription: d.seoDescription || '',
        status: d.status || 'active',
        sortOrder: Number(d.sortOrder) || 0,
        priceVisibility: d.priceVisibility || 'inherit',
        stockVisibility: d.stockVisibility || 'inherit',
        inquiryEnabled: d.inquiryEnabled || 'inherit',
        displayLayout: d.displayLayout || 'grid',
      })
      .returning();
    res.status(201).json({ category: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create category.' });
  }
});

router.put('/categories/:id', requirePermission('categories', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const d = req.body;
    const [updated] = await db
      .update(categories)
      .set({
        parentId: d.parentId ? Number(d.parentId) : null,
        name: d.name,
        slug: slugify(d.slug || d.name),
        description: d.description || '',
        imageUrl: d.imageUrl || '',
        icon: d.icon || '',
        seoTitle: d.seoTitle || '',
        seoDescription: d.seoDescription || '',
        status: d.status || 'active',
        sortOrder: Number(d.sortOrder) || 0,
        priceVisibility: d.priceVisibility || 'inherit',
        stockVisibility: d.stockVisibility || 'inherit',
        inquiryEnabled: d.inquiryEnabled || 'inherit',
        displayLayout: d.displayLayout || 'grid',
      })
      .where(eq(categories.id, id))
      .returning();
    res.json({ category: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update category.' });
  }
});

router.delete('/categories/:id', requirePermission('categories', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(categories).where(eq(categories.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.get('/brands', requirePermission('brands', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(brands).orderBy(asc(brands.name));
  res.json({ brands: rows });
});

router.post('/brands', requirePermission('brands', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [created] = await db
      .insert(brands)
      .values({
        name: d.name,
        slug: slugify(d.slug || d.name),
        logoUrl: d.logoUrl || '',
        description: d.description || '',
        seoTitle: d.seoTitle || '',
        seoDescription: d.seoDescription || '',
        status: d.status || 'active',
      })
      .returning();
    res.status(201).json({ brand: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create brand.' });
  }
});

router.put('/brands/:id', requirePermission('brands', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [updated] = await db
      .update(brands)
      .set({
        name: d.name,
        slug: slugify(d.slug || d.name),
        logoUrl: d.logoUrl || '',
        description: d.description || '',
        seoTitle: d.seoTitle || '',
        seoDescription: d.seoDescription || '',
        status: d.status || 'active',
      })
      .where(eq(brands.id, Number(req.params.id)))
      .returning();
    res.json({ brand: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update brand.' });
  }
});

router.delete('/brands/:id', requirePermission('brands', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(brands).where(eq(brands.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.get('/attributes', requirePermission('attributes', 'canView'), async (_req: AuthRequest, res: Response) => {
  const attrs = await db.select().from(attributes).orderBy(asc(attributes.sortOrder));
  const vals = await db.select().from(attributeValues).orderBy(asc(attributeValues.sortOrder));
  res.json({
    attributes: attrs.map((a) => ({
      ...a,
      values: vals.filter((v) => v.attributeId === a.id),
    })),
  });
});

router.post('/attributes', requirePermission('attributes', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [created] = await db
      .insert(attributes)
      .values({
        name: d.name,
        slug: slugify(d.slug || d.name),
        displayType: d.displayType || 'button',
        usedForVariations: d.usedForVariations !== false,
        usedForFiltering: d.usedForFiltering !== false,
        sortOrder: Number(d.sortOrder) || 0,
      })
      .returning();
    res.status(201).json({ attribute: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create attribute.' });
  }
});

router.delete('/attributes/:id', requirePermission('attributes', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(attributes).where(eq(attributes.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.post('/attribute-values', requirePermission('attributes', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [created] = await db
      .insert(attributeValues)
      .values({
        attributeId: Number(d.attributeId),
        value: d.value,
        slug: slugify(d.slug || d.value),
        colorHex: d.colorHex || '',
        sortOrder: Number(d.sortOrder) || 0,
      })
      .returning();
    res.status(201).json({ value: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add attribute value.' });
  }
});

router.delete('/attribute-values/:id', requirePermission('attributes', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(attributeValues).where(eq(attributeValues.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.get('/inventory', requirePermission('inventory', 'canView'), async (_req: AuthRequest, res: Response) => {
  const prods = await db.select().from(products).orderBy(asc(products.name));
  const vars = await db.select().from(productVariations).orderBy(asc(productVariations.sku));
  const logs = await db.select().from(inventoryLogs).orderBy(desc(inventoryLogs.createdAt)).limit(50);
  res.json({ products: prods, variations: vars, logs });
});

router.post('/inventory/adjust', requirePermission('inventory', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { productId, variationId = null, sku, delta, reason = 'Manual admin adjustment' } = req.body;
    await adjustStockAndLog({
      productId: Number(productId),
      variationId: variationId ? Number(variationId) : null,
      sku,
      delta: Number(delta),
      reason,
      reference: req.dbUser?.email || 'admin',
    });
    res.json({ adjusted: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust inventory.' });
  }
});

// ============================================================================
// 5. ORDERS MANAGEMENT & CSV EXPORT
// ============================================================================

router.get('/orders', requirePermission('orders', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  res.json({ orders: rows });
});

router.get('/orders/export/csv', requirePermission('orders', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const header = 'Order Number,Date,Customer,Email,Company,Payment Method,Payment Status,Order Status,Subtotal,Discount,Shipping,Tax,Total\n';
  const body = rows
    .map((o) =>
      [
        o.orderNumber,
        new Date(o.createdAt).toISOString(),
        `"${o.customerName.replace(/"/g, '""')}"`,
        o.customerEmail,
        `"${(o.companyName || '').replace(/"/g, '""')}"`,
        o.paymentMethod,
        o.paymentStatus,
        o.orderStatus,
        o.subtotal,
        o.discountAmount,
        o.shippingCost,
        o.taxAmount,
        o.totalAmount,
      ].join(',')
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
  res.send(header + body);
});

router.get('/orders/:id', requirePermission('orders', 'canView'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Order not found.' });
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const history = await db
    .select()
    .from(orderHistory)
    .where(eq(orderHistory.orderId, id))
    .orderBy(desc(orderHistory.createdAt));
  res.json({ order: rows[0], items, history });
});

router.put('/orders/:id', requirePermission('orders', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (existing.length === 0) return res.status(404).json({ error: 'Order not found.' });

    const { orderStatus, paymentStatus, internalNotes, customerNotes, shippingAddress, note } = req.body;
    const nextOrderStatus = orderStatus || existing[0].orderStatus;
    const nextPaymentStatus = paymentStatus || existing[0].paymentStatus;

    const [updated] = await db
      .update(orders)
      .set({
        orderStatus: nextOrderStatus,
        paymentStatus: nextPaymentStatus,
        internalNotes: internalNotes !== undefined ? internalNotes : existing[0].internalNotes,
        customerNotes: customerNotes !== undefined ? customerNotes : existing[0].customerNotes,
        shippingAddress: shippingAddress || existing[0].shippingAddress,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    if (
      nextOrderStatus !== existing[0].orderStatus ||
      nextPaymentStatus !== existing[0].paymentStatus ||
      note
    ) {
      await db.insert(orderHistory).values({
        orderId: id,
        orderStatus: nextOrderStatus,
        paymentStatus: nextPaymentStatus,
        note: note || `Updated order status to ${nextOrderStatus}, payment to ${nextPaymentStatus}.`,
        changedBy: req.dbUser?.email || 'admin',
      });

      await dispatchNotification(
        'order.updated',
        updated.customerEmail,
        {
          customerName: updated.customerName,
          orderNumber: updated.orderNumber,
          orderStatus: nextOrderStatus,
          paymentStatus: nextPaymentStatus,
        },
        'order',
        updated.id
      );
    }

    res.json({ order: updated });
  } catch (error) {
    console.error('Order update error:', error);
    res.status(500).json({ error: 'Failed to update order.' });
  }
});

// ============================================================================
// 6. INQUIRIES & QUOTATIONS
// ============================================================================

router.get('/inquiries', requirePermission('inquiries', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
  res.json({ inquiries: rows });
});

router.get('/inquiries/export/csv', requirePermission('inquiries', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
  const header = 'Inquiry Ref,Date,Customer,Company,Email,Phone,Status,Message\n';
  const body = rows
    .map((i) =>
      [
        i.inquiryRef,
        new Date(i.createdAt).toISOString(),
        `"${i.customerName.replace(/"/g, '""')}"`,
        `"${(i.companyName || '').replace(/"/g, '""')}"`,
        i.email,
        i.phone || '',
        i.status,
        `"${(i.message || '').replace(/"/g, '""')}"`,
      ].join(',')
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inquiries-export.csv"');
  res.send(header + body);
});

router.get('/inquiries/:id', requirePermission('inquiries', 'canView'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Inquiry not found.' });
  const items = await db.select().from(inquiryItems).where(eq(inquiryItems.inquiryId, id));
  const linkedQuotes = await db.select().from(quotations).where(eq(quotations.inquiryId, id));
  res.json({ inquiry: rows[0], items, quotations: linkedQuotes });
});

router.put('/inquiries/:id', requirePermission('inquiries', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { status, internalNotes } = req.body;
  const [updated] = await db
    .update(inquiries)
    .set({
      status,
      internalNotes,
      updatedAt: new Date(),
    })
    .where(eq(inquiries.id, id))
    .returning();
  res.json({ inquiry: updated });
});

router.post('/inquiries/:id/create-quotation', requirePermission('quotations', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const inqRows = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
    if (inqRows.length === 0) return res.status(404).json({ error: 'Inquiry not found.' });
    const inq = inqRows[0];
    const items = await db.select().from(inquiryItems).where(eq(inquiryItems.inquiryId, id));

    const quoteRef = generateUniqueRef('QT');
    const secureToken = generateSecureToken();
    const [created] = await db
      .insert(quotations)
      .values({
        quoteRef,
        secureToken,
        inquiryId: inq.id,
        customerId: inq.customerId,
        customerName: inq.customerName,
        companyName: inq.companyName || '',
        email: inq.email,
        phone: inq.phone || '',
        status: 'draft',
        taxRate: 8.5,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();

    for (const item of items) {
      let unitPrice = 0;
      if (item.variationId) {
        const v = await db
          .select()
          .from(productVariations)
          .where(eq(productVariations.id, item.variationId))
          .limit(1);
        if (v.length > 0) unitPrice = v[0].salePrice ?? v[0].regularPrice;
      } else if (item.productId) {
        const p = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
        if (p.length > 0) unitPrice = p[0].salePrice ?? p[0].regularPrice;
      }

      await db.insert(quotationItems).values({
        quotationId: created.id,
        productId: item.productId,
        variationId: item.variationId,
        productName: item.productName,
        productImage: item.productImage || '',
        sku: item.sku,
        variationLabel: item.variationLabel || '',
        quantity: item.quantity,
        unitPrice,
        lineDiscount: 0,
        lineTotal: roundMoney(unitPrice * item.quantity),
      });
    }

    await db
      .update(inquiries)
      .set({ status: 'quoted', updatedAt: new Date() })
      .where(eq(inquiries.id, inq.id));

    const finalQuote = await recalculateAndSaveQuotationTotals(created.id);
    res.status(201).json({ quotation: finalQuote });
  } catch (error) {
    console.error('Create quotation from inquiry error:', error);
    res.status(500).json({ error: 'Failed to create quotation.' });
  }
});

router.post('/inquiries/:id/convert-to-order', requirePermission('orders', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const inqRows = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
    if (inqRows.length === 0) return res.status(404).json({ error: 'Inquiry not found.' });
    const inq = inqRows[0];
    const items = await db.select().from(inquiryItems).where(eq(inquiryItems.inquiryId, id));
    if (items.length === 0) return res.status(400).json({ error: 'Inquiry has no line items.' });

    let subtotal = 0;
    const prepared = [];
    for (const item of items) {
      let unitPrice = 0;
      if (item.variationId) {
        const v = await db
          .select()
          .from(productVariations)
          .where(eq(productVariations.id, item.variationId))
          .limit(1);
        if (v.length > 0) unitPrice = v[0].salePrice ?? v[0].regularPrice;
      } else if (item.productId) {
        const p = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
        if (p.length > 0) unitPrice = p[0].salePrice ?? p[0].regularPrice;
      }
      const lineTotal = roundMoney(unitPrice * item.quantity);
      subtotal += lineTotal;
      prepared.push({ ...item, unitPrice, lineTotal });
    }

    const orderNumber = generateUniqueRef('KA');
    const addr = {
      firstName: inq.customerName.split(' ')[0] || inq.customerName,
      lastName: inq.customerName.split(' ').slice(1).join(' ') || '',
      company: inq.companyName || '',
      address1: 'Address confirmed via Inquiry',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94107',
      country: 'United States',
      phone: inq.phone || '',
      email: inq.email,
    };

    const [newOrder] = await db
      .insert(orders)
      .values({
        orderNumber,
        customerId: inq.customerId,
        customerEmail: inq.email,
        customerName: inq.customerName,
        customerPhone: inq.phone || '',
        companyName: inq.companyName || '',
        billingAddress: addr,
        shippingAddress: addr,
        shippingMethodName: inq.preferredShippingMethod || 'Standard Courier',
        shippingCost: 0,
        subtotal: roundMoney(subtotal),
        taxAmount: 0,
        totalAmount: roundMoney(subtotal),
        paymentMethod: 'cod',
        paymentStatus: 'unpaid',
        orderStatus: 'pending',
        internalNotes: `Converted directly from Inquiry ${inq.inquiryRef}`,
        sourceInquiryId: inq.id,
      })
      .returning();

    for (const item of prepared) {
      await db.insert(orderItems).values({
        orderId: newOrder.id,
        productId: item.productId,
        variationId: item.variationId,
        productName: item.productName,
        productImage: item.productImage || '',
        sku: item.sku,
        variationLabel: item.variationLabel || '',
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      });
    }

    await db.insert(orderHistory).values({
      orderId: newOrder.id,
      orderStatus: 'pending',
      paymentStatus: 'unpaid',
      note: `Converted from Inquiry ${inq.inquiryRef}.`,
      changedBy: req.dbUser?.email || 'admin',
    });

    await db
      .update(inquiries)
      .set({ status: 'converted', updatedAt: new Date() })
      .where(eq(inquiries.id, inq.id));

    res.status(201).json({ order: newOrder });
  } catch (error) {
    console.error('Convert inquiry error:', error);
    res.status(500).json({ error: 'Failed to convert inquiry to order.' });
  }
});

// Quotations CRUD
router.get('/quotations', requirePermission('quotations', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(quotations).orderBy(desc(quotations.createdAt));
  res.json({ quotations: rows });
});

router.get('/quotations/:id', requirePermission('quotations', 'canView'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Quotation not found.' });
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
  res.json({ quotation: rows[0], items });
});

router.post('/quotations', requirePermission('quotations', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [created] = await db
      .insert(quotations)
      .values({
        quoteRef: generateUniqueRef('QT'),
        secureToken: generateSecureToken(),
        inquiryId: d.inquiryId ? Number(d.inquiryId) : null,
        customerId: d.customerId ? Number(d.customerId) : null,
        customerName: d.customerName,
        companyName: d.companyName || '',
        email: d.email,
        phone: d.phone || '',
        status: 'draft',
        discountType: d.discountType || 'fixed',
        discountValue: Number(d.discountValue) || 0,
        shippingCost: Number(d.shippingCost) || 0,
        taxRate: Number(d.taxRate) || 0,
        additionalFees: Number(d.additionalFees) || 0,
        notes: d.notes || '',
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();

    if (Array.isArray(d.items)) {
      for (const item of d.items) {
        await db.insert(quotationItems).values({
          quotationId: created.id,
          productId: item.productId ? Number(item.productId) : null,
          variationId: item.variationId ? Number(item.variationId) : null,
          productName: item.productName,
          productImage: item.productImage || '',
          sku: item.sku || 'CUSTOM',
          variationLabel: item.variationLabel || '',
          quantity: Math.max(1, Number(item.quantity) || 1),
          unitPrice: Number(item.unitPrice) || 0,
          lineDiscount: Number(item.lineDiscount) || 0,
          lineTotal: 0,
        });
      }
    }

    const updated = await recalculateAndSaveQuotationTotals(created.id);
    const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, created.id));
    res.status(201).json({ quotation: updated, items });
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({ error: 'Failed to create quotation.' });
  }
});

router.put('/quotations/:id', requirePermission('quotations', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const d = req.body;
    await db
      .update(quotations)
      .set({
        customerName: d.customerName,
        companyName: d.companyName || '',
        email: d.email,
        phone: d.phone || '',
        status: d.status,
        discountType: d.discountType || 'fixed',
        discountValue: Number(d.discountValue) || 0,
        shippingCost: Number(d.shippingCost) || 0,
        taxRate: Number(d.taxRate) || 0,
        additionalFees: Number(d.additionalFees) || 0,
        notes: d.notes || '',
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id));

    if (Array.isArray(d.items)) {
      await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
      for (const item of d.items) {
        await db.insert(quotationItems).values({
          quotationId: id,
          productId: item.productId ? Number(item.productId) : null,
          variationId: item.variationId ? Number(item.variationId) : null,
          productName: item.productName,
          productImage: item.productImage || '',
          sku: item.sku || 'CUSTOM',
          variationLabel: item.variationLabel || '',
          quantity: Math.max(1, Number(item.quantity) || 1),
          unitPrice: Number(item.unitPrice) || 0,
          lineDiscount: Number(item.lineDiscount) || 0,
          lineTotal: 0,
        });
      }
    }

    const updated = await recalculateAndSaveQuotationTotals(id);
    const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
    res.json({ quotation: updated, items });
  } catch (error) {
    console.error('Update quotation error:', error);
    res.status(500).json({ error: 'Failed to update quotation.' });
  }
});

router.post('/quotations/:id/send', requirePermission('quotations', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(quotations)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Quotation not found.' });

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const quoteUrl = `${baseUrl}/quotation/${updated.quoteRef}?token=${updated.secureToken}`;

    await dispatchNotification(
      'quotation.sent',
      updated.email,
      {
        customerName: updated.customerName,
        quoteRef: updated.quoteRef,
        grandTotal: `$${updated.grandTotal.toFixed(2)}`,
        quoteUrl,
      },
      'quotation',
      updated.id
    );

    res.json({ quotation: updated, quoteUrl });
  } catch (error) {
    console.error('Send quotation error:', error);
    res.status(500).json({ error: 'Failed to send quotation.' });
  }
});

router.post('/quotations/:id/convert-to-order', requirePermission('orders', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const order = await convertQuotationToOrder(Number(req.params.id), req.dbUser?.email || 'admin');
    res.status(201).json({ order });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to convert quotation.' });
  }
});

router.delete('/quotations/:id', requirePermission('quotations', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(quotations).where(eq(quotations.id, Number(req.params.id)));
  res.json({ deleted: true });
});

// ============================================================================
// 7. CUSTOMERS (REGISTERED USERS & PURCHASES), INVOICES, COUPONS, SHIPPING
// ============================================================================

router.get('/customers', requirePermission('customers', 'canView'), async (_req: AuthRequest, res: Response) => {
  try {
    const [allCustomersRaw, allUsers, allRoles, allOrders, allOrderItems, allInquiries, allQuotations] =
      await Promise.all([
        db.select().from(customers).orderBy(desc(customers.createdAt)),
        db.select().from(users).orderBy(desc(users.createdAt)),
        db.select().from(roles),
        db.select().from(orders).orderBy(desc(orders.createdAt)),
        db.select().from(orderItems),
        db.select().from(inquiries).orderBy(desc(inquiries.createdAt)),
        db.select().from(quotations).orderBy(desc(quotations.createdAt)),
      ]);

    const roleMap = new Map(allRoles.map((r) => [r.id, r]));

    // Ensure every registered Firebase/app user has a linked customer row for seamless drill-down
    const custByUserId = new Map<number, typeof customers.$inferSelect>();
    const custByEmail = new Map<string, typeof customers.$inferSelect>();
    for (const c of allCustomersRaw) {
      if (c.userId) custByUserId.set(c.userId, c);
      if (c.email) custByEmail.set(c.email.trim().toLowerCase(), c);
    }

    const addedCustomers: Array<typeof customers.$inferSelect> = [];
    for (const u of allUsers) {
      const emailKey = (u.email || '').trim().toLowerCase();
      if (!emailKey) continue;
      if (!custByUserId.has(u.id) && !custByEmail.has(emailKey)) {
        const parts = (u.displayName || emailKey.split('@')[0] || 'Customer').trim().split(/\s+/);
        const [inserted] = await db
          .insert(customers)
          .values({
            userId: u.id,
            firstName: parts[0] || 'Customer',
            lastName: parts.slice(1).join(' ') || '',
            email: emailKey,
          })
          .returning();
        if (inserted) {
          addedCustomers.push(inserted);
          custByUserId.set(u.id, inserted);
          custByEmail.set(emailKey, inserted);
        }
      }
    }

    const allCustomers = [...addedCustomers, ...allCustomersRaw];
    const userById = new Map(allUsers.map((u) => [u.id, u]));
    const userByEmail = new Map(allUsers.map((u) => [u.email.trim().toLowerCase(), u]));

    const itemsByOrder = new Map<number, Array<typeof orderItems.$inferSelect>>();
    for (const it of allOrderItems) {
      const list = itemsByOrder.get(it.orderId) || [];
      list.push(it);
      itemsByOrder.set(it.orderId, list);
    }

    const enriched = allCustomers.map((c) => {
      const emailKey = (c.email || '').trim().toLowerCase();
      const linkedUser = (c.userId ? userById.get(c.userId) : undefined) || userByEmail.get(emailKey) || null;
      const roleObj = linkedUser?.roleId ? roleMap.get(linkedUser.roleId) || null : null;

      const custOrders = allOrders.filter(
        (o) => o.customerId === c.id || o.customerEmail.trim().toLowerCase() === emailKey
      );
      const validOrders = custOrders.filter(
        (o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'refunded'
      );
      const totalSpent = roundMoney(validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0));
      const purchasedItemsCount = custOrders.reduce((sum, o) => {
        const oItems = itemsByOrder.get(o.id) || [];
        return sum + oItems.reduce((s, it) => s + (it.quantity || 0), 0);
      }, 0);

      const custInquiries = allInquiries.filter(
        (i) => i.customerId === c.id || i.email.trim().toLowerCase() === emailKey
      );
      const custQuotes = allQuotations.filter(
        (q) => q.customerId === c.id || q.email.trim().toLowerCase() === emailKey
      );

      const recentPurchases = custOrders.slice(0, 3).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        itemsCount: (itemsByOrder.get(o.id) || []).reduce((s, it) => s + (it.quantity || 0), 0),
        itemTitles: (itemsByOrder.get(o.id) || []).slice(0, 2).map((it) => it.productName),
      }));

      return {
        ...c,
        isRegistered: Boolean(linkedUser),
        registeredAt: linkedUser?.createdAt || null,
        userId: linkedUser?.id || c.userId || null,
        displayName: linkedUser?.displayName || `${c.firstName} ${c.lastName}`.trim(),
        photoUrl: linkedUser?.photoUrl || '',
        roleName: roleObj?.name || (linkedUser ? 'Customer' : 'Guest Buyer'),
        roleSlug: roleObj?.slug || (linkedUser ? 'customer' : 'guest'),
        accountActive: linkedUser ? linkedUser.isActive : true,
        ordersCount: custOrders.length,
        totalSpent,
        purchasedItemsCount,
        inquiriesCount: custInquiries.length,
        quotationsCount: custQuotes.length,
        lastPurchaseAt: custOrders[0]?.createdAt || null,
        lastOrderNumber: custOrders[0]?.orderNumber || '',
        recentPurchases,
      };
    });

    res.json({ customers: enriched });
  } catch (error) {
    console.error('Admin customers list error:', error);
    res.status(500).json({ error: 'Failed to load customers.' });
  }
});

router.get('/customers/:id', requirePermission('customers', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
    const c = rows[0];
    const emailKey = (c.email || '').trim().toLowerCase();

    const [allUsers, allRoles, allOrders, allInquiries, allQuotes] = await Promise.all([
      db.select().from(users),
      db.select().from(roles),
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(inquiries).orderBy(desc(inquiries.createdAt)),
      db.select().from(quotations).orderBy(desc(quotations.createdAt)),
    ]);

    const linkedUser =
      allUsers.find((u) => (c.userId && u.id === c.userId) || u.email.trim().toLowerCase() === emailKey) ||
      null;
    const roleObj = linkedUser?.roleId ? allRoles.find((r) => r.id === linkedUser.roleId) || null : null;

    const custOrders = allOrders.filter(
      (o) => o.customerId === c.id || o.customerEmail.trim().toLowerCase() === emailKey
    );
    const orderIds = custOrders.map((o) => o.id);
    const custOrderItems =
      orderIds.length > 0
        ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
        : [];
    const enrichedOrders = custOrders.map((o) => ({
      ...o,
      items: custOrderItems.filter((it) => it.orderId === o.id),
    }));

    const custInquiries = allInquiries.filter(
      (i) => i.customerId === c.id || i.email.trim().toLowerCase() === emailKey
    );
    const inqIds = custInquiries.map((i) => i.id);
    const custInqItems =
      inqIds.length > 0
        ? await db.select().from(inquiryItems).where(inArray(inquiryItems.inquiryId, inqIds))
        : [];
    const enrichedInquiries = custInquiries.map((inq) => ({
      ...inq,
      items: custInqItems.filter((it) => it.inquiryId === inq.id),
    }));

    const custQuotes = allQuotes.filter(
      (q) => q.customerId === c.id || q.email.trim().toLowerCase() === emailKey
    );

    const validOrders = enrichedOrders.filter(
      (o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'refunded'
    );
    const totalSpent = roundMoney(validOrders.reduce((s, o) => s + (o.totalAmount || 0), 0));
    const purchasedItemsCount = custOrderItems.reduce((s, it) => s + (it.quantity || 0), 0);

    res.json({
      customer: c,
      registeredUser: linkedUser
        ? {
            id: linkedUser.id,
            email: linkedUser.email,
            displayName: linkedUser.displayName,
            photoUrl: linkedUser.photoUrl,
            isActive: linkedUser.isActive,
            createdAt: linkedUser.createdAt,
            roleName: roleObj?.name || 'Customer',
            roleSlug: roleObj?.slug || 'customer',
          }
        : null,
      orders: enrichedOrders,
      inquiries: enrichedInquiries,
      quotations: custQuotes,
      stats: {
        ordersCount: enrichedOrders.length,
        totalSpent,
        purchasedItemsCount,
        avgOrderValue: validOrders.length > 0 ? roundMoney(totalSpent / validOrders.length) : 0,
        inquiriesCount: enrichedInquiries.length,
        quotationsCount: custQuotes.length,
      },
    });
  } catch (error) {
    console.error('Customer detail error:', error);
    res.status(500).json({ error: 'Failed to load customer details.' });
  }
});

router.put('/customers/:id', requirePermission('customers', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const d = req.body;
  const [updated] = await db
    .update(customers)
    .set({
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone || '',
      companyName: d.companyName || '',
      billingAddress: d.billingAddress || '',
      shippingAddress: d.shippingAddress || '',
      city: d.city || '',
      stateRegion: d.stateRegion || '',
      postalCode: d.postalCode || '',
      country: d.country || '',
      notes: d.notes || '',
      updatedAt: new Date(),
    })
    .where(eq(customers.id, Number(req.params.id)))
    .returning();
  res.json({ customer: updated });
});

router.get('/invoices', requirePermission('orders', 'canView'), async (_req: AuthRequest, res: Response) => {
  try {
    const [allSettings, orderRows, allItems, allUsers] = await Promise.all([
      getAllSettings(),
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(orderItems),
      db.select({ id: users.id, email: users.email, displayName: users.displayName }).from(users),
    ]);
    const prefix = String(allSettings.invoice?.invoiceNumberPrefix || 'INV-').trim();
    const registeredEmails = new Set(allUsers.map((u) => u.email.trim().toLowerCase()));
    const itemsByOrder = new Map<number, Array<typeof orderItems.$inferSelect>>();
    for (const it of allItems) {
      const list = itemsByOrder.get(it.orderId) || [];
      list.push(it);
      itemsByOrder.set(it.orderId, list);
    }

    const enriched = orderRows.map((o) => ({
      ...o,
      invoiceNumber:
        prefix && !o.orderNumber.toUpperCase().startsWith(prefix.toUpperCase())
          ? `${prefix}${o.orderNumber}`
          : o.orderNumber,
      isRegisteredCustomer: registeredEmails.has(o.customerEmail.trim().toLowerCase()),
      items: itemsByOrder.get(o.id) || [],
    }));

    res.json({
      invoices: enriched,
      invoiceSettings: allSettings.invoice,
      generalSettings: allSettings.general,
    });
  } catch (error) {
    console.error('Admin invoices error:', error);
    res.status(500).json({ error: 'Failed to load invoices.' });
  }
});

router.post('/invoices/:orderId/send', requirePermission('orders', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const orderId = Number(req.params.orderId);
    const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: 'Order / invoice not found.' });
    const ord = rows[0];
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const allSettings = await getAllSettings();
    const { renderInvoiceHtml, formatInvoiceNumber } = await import('../../utils/invoiceRenderer.ts');

    const invNumber = formatInvoiceNumber(
      ord.orderNumber,
      String(allSettings.invoice?.invoiceNumberPrefix || 'INV-')
    );
    const html = renderInvoiceHtml({
      order: {
        ...ord,
        createdAt: ord.createdAt.toISOString(),
        items,
      },
      invoiceSettings: req.body?.invoiceSettings || allSettings.invoice,
      generalSettings: allSettings.general,
      currency: allSettings.general?.currencySymbol || '$',
    });

    const recipient = String(req.body?.recipientEmail || ord.customerEmail).trim();
    const subject = `${allSettings.invoice?.documentTitle || 'INVOICE'} ${invNumber} — ${
      allSettings.general?.siteName || 'Kanso Atelier'
    }`;

    const [log] = await db
      .insert(notifications)
      .values({
        type: 'invoice.sent',
        recipientEmail: recipient,
        subject,
        body: html,
        status: 'sent',
        relatedEntityType: 'order',
        relatedEntityId: ord.id,
      })
      .returning();

    res.json({ sent: true, invoiceNumber: invNumber, log });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to dispatch invoice email.' });
  }
});

router.get('/coupons', requirePermission('coupons', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  const usages = await db.select().from(couponUsage).orderBy(desc(couponUsage.usedAt));
  res.json({ coupons: rows, usages });
});

router.post('/coupons', requirePermission('coupons', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [created] = await db
      .insert(coupons)
      .values({
        code: String(d.code).trim().toUpperCase(),
        description: d.description || '',
        discountType: d.discountType || 'percentage',
        discountValue: Number(d.discountValue) || 0,
        startDate: d.startDate ? new Date(d.startDate) : null,
        expirationDate: d.expirationDate ? new Date(d.expirationDate) : null,
        minPurchaseAmount: Number(d.minPurchaseAmount) || 0,
        maxDiscountAmount: d.maxDiscountAmount ? Number(d.maxDiscountAmount) : null,
        maxUsage: d.maxUsage ? Number(d.maxUsage) : null,
        usageLimitPerCustomer: d.usageLimitPerCustomer ? Number(d.usageLimitPerCustomer) : null,
        applicableProductIds: d.applicableProductIds || [],
        applicableCategoryIds: d.applicableCategoryIds || [],
        excludedProductIds: d.excludedProductIds || [],
        excludedCategoryIds: d.excludedCategoryIds || [],
        isActive: d.isActive !== false,
      })
      .returning();
    res.status(201).json({ coupon: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create coupon.' });
  }
});

router.put('/coupons/:id', requirePermission('coupons', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const d = req.body;
  const [updated] = await db
    .update(coupons)
    .set({
      code: String(d.code).trim().toUpperCase(),
      description: d.description || '',
      discountType: d.discountType || 'percentage',
      discountValue: Number(d.discountValue) || 0,
      startDate: d.startDate ? new Date(d.startDate) : null,
      expirationDate: d.expirationDate ? new Date(d.expirationDate) : null,
      minPurchaseAmount: Number(d.minPurchaseAmount) || 0,
      maxDiscountAmount: d.maxDiscountAmount ? Number(d.maxDiscountAmount) : null,
      maxUsage: d.maxUsage ? Number(d.maxUsage) : null,
      usageLimitPerCustomer: d.usageLimitPerCustomer ? Number(d.usageLimitPerCustomer) : null,
      isActive: d.isActive !== false,
    })
    .where(eq(coupons.id, Number(req.params.id)))
    .returning();
  res.json({ coupon: updated });
});

router.delete('/coupons/:id', requirePermission('coupons', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(coupons).where(eq(coupons.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.get('/shipping', requirePermission('shipping', 'canView'), async (_req: AuthRequest, res: Response) => {
  try {
    const zones = await db.select().from(shippingZones).orderBy(asc(shippingZones.name));
    const methods = await db.select().from(shippingMethods).orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.id));
    res.json({ zones, methods });
  } catch (error: any) {
    console.error('Get shipping error:', error);
    res.status(500).json({ error: error?.message || 'Failed to load shipping configuration.' });
  }
});

router.post('/shipping-zones', requirePermission('shipping', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [created] = await db
      .insert(shippingZones)
      .values({
        name: String(d.name || '').trim(),
        countries: Array.isArray(d.countries) ? d.countries : [],
        regions: Array.isArray(d.regions) ? d.regions : [],
        postalCodes: Array.isArray(d.postalCodes) ? d.postalCodes : [],
        isActive: d.isActive !== false,
      })
      .returning();
    res.status(201).json({ zone: created });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create shipping zone.' });
  }
});

router.put('/shipping-zones/:id', requirePermission('shipping', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [updated] = await db
      .update(shippingZones)
      .set({
        name: String(d.name || '').trim(),
        countries: Array.isArray(d.countries) ? d.countries : [],
        regions: Array.isArray(d.regions) ? d.regions : [],
        postalCodes: Array.isArray(d.postalCodes) ? d.postalCodes : [],
        isActive: d.isActive !== false,
      })
      .where(eq(shippingZones.id, Number(req.params.id)))
      .returning();
    res.json({ zone: updated });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to update shipping zone.' });
  }
});

router.delete('/shipping-zones/:id', requirePermission('shipping', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const zoneId = Number(req.params.id);
    await db.update(shippingMethods).set({ zoneId: null }).where(eq(shippingMethods.zoneId, zoneId));
    await db.delete(shippingZones).where(eq(shippingZones.id, zoneId));
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete shipping zone.' });
  }
});

router.post('/shipping-methods', requirePermission('shipping', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [created] = await db
      .insert(shippingMethods)
      .values({
        zoneId: d.zoneId ? Number(d.zoneId) : null,
        name: String(d.name || '').trim(),
        description: String(d.description || '').trim(),
        price: Math.max(0, Number(d.price) || 0),
        freeShippingThreshold:
          d.freeShippingThreshold !== null &&
          d.freeShippingThreshold !== undefined &&
          d.freeShippingThreshold !== ''
            ? Number(d.freeShippingThreshold)
            : null,
        estimatedDeliveryTime: String(d.estimatedDeliveryTime || '3-5 business days').trim(),
        countries: Array.isArray(d.countries) ? d.countries : [],
        regions: Array.isArray(d.regions) ? d.regions : [],
        postalCodes: Array.isArray(d.postalCodes) ? d.postalCodes : [],
        isActive: d.isActive !== false,
        sortOrder: Number(d.sortOrder) || 0,
      })
      .returning();
    res.status(201).json({ method: created });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create shipping method.' });
  }
});

router.put('/shipping-methods/:id', requirePermission('shipping', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [updated] = await db
      .update(shippingMethods)
      .set({
        zoneId: d.zoneId ? Number(d.zoneId) : null,
        name: String(d.name || '').trim(),
        description: String(d.description || '').trim(),
        price: Math.max(0, Number(d.price) || 0),
        freeShippingThreshold:
          d.freeShippingThreshold !== null &&
          d.freeShippingThreshold !== undefined &&
          d.freeShippingThreshold !== ''
            ? Number(d.freeShippingThreshold)
            : null,
        estimatedDeliveryTime: String(d.estimatedDeliveryTime || '3-5 business days').trim(),
        countries: Array.isArray(d.countries) ? d.countries : [],
        regions: Array.isArray(d.regions) ? d.regions : [],
        postalCodes: Array.isArray(d.postalCodes) ? d.postalCodes : [],
        isActive: d.isActive !== false,
        sortOrder: Number(d.sortOrder) || 0,
      })
      .where(eq(shippingMethods.id, Number(req.params.id)))
      .returning();
    res.json({ method: updated });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to update shipping method.' });
  }
});

router.delete('/shipping-methods/:id', requirePermission('shipping', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    await db.delete(shippingMethods).where(eq(shippingMethods.id, Number(req.params.id)));
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete shipping method.' });
  }
});

// ============================================================================
// 8. BULK PRODUCT IMPORT & EXPORT (CSV / XLSX)
// ============================================================================

router.get('/import-export/template', requirePermission('import_export', 'canView'), (_req: AuthRequest, res: Response) => {
  const sample = [
    {
      sku: 'KA-SMP-101',
      name: 'Linear Brass Table Light',
      slug: 'linear-brass-table-light',
      productType: 'simple',
      parentSku: '',
      regularPrice: 340,
      salePrice: 295,
      stockQuantity: 15,
      categories: 'Lighting|Task Lamps',
      brand: 'Kanso Studio',
      shortDescription: 'Architectural solid brass desk luminaire.',
      imageUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
      attributes: '',
      status: 'published',
    },
    {
      sku: 'KA-VAR-201',
      name: 'Modular Bench System',
      slug: 'modular-bench-system',
      productType: 'variable',
      parentSku: '',
      regularPrice: 890,
      salePrice: '',
      stockQuantity: 10,
      categories: 'Seating & Joinery',
      brand: 'Nordic Form',
      shortDescription: 'Solid oak architectural gallery bench.',
      imageUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
      attributes: 'Finish / Color:Natural Oak|Size:Standard',
      status: 'published',
    },
    {
      sku: 'KA-VAR-201-OAK-STD',
      name: 'Modular Bench System - Natural Oak / Standard',
      slug: '',
      productType: 'variation',
      parentSku: 'KA-VAR-201',
      regularPrice: 890,
      salePrice: '',
      stockQuantity: 6,
      categories: '',
      brand: '',
      shortDescription: '',
      imageUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
      attributes: 'Finish / Color:Natural Oak|Size:Standard',
      status: 'published',
    },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sample);
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const csv = XLSX.utils.sheet_to_csv(ws);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kanso-product-import-template.csv"');
  res.send(csv);
});

router.get('/import-export/export', requirePermission('import_export', 'canView'), async (req: AuthRequest, res: Response) => {
  const format = String(req.query.format || 'csv').toLowerCase();
  const categoryIdFilter = req.query.categoryId ? Number(req.query.categoryId) : null;
  const brandIdFilter = req.query.brandId ? Number(req.query.brandId) : null;

  let prods = await db.select().from(products).orderBy(asc(products.id));
  const allCats = await db.select().from(categories);
  const allBrands = await db.select().from(brands);
  const catLinks = await db.select().from(productCategories);
  const vars = await db.select().from(productVariations);

  if (brandIdFilter) prods = prods.filter((p) => p.brandId === brandIdFilter);
  if (categoryIdFilter) {
    const validIds = new Set(catLinks.filter((l) => l.categoryId === categoryIdFilter).map((l) => l.productId));
    prods = prods.filter((p) => validIds.has(p.id));
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const p of prods) {
    const pCats = catLinks
      .filter((l) => l.productId === p.id)
      .map((l) => allCats.find((c) => c.id === l.categoryId)?.name)
      .filter(Boolean)
      .join('|');
    const brandName = allBrands.find((b) => b.id === p.brandId)?.name || '';
    rows.push({
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      productType: p.productType,
      parentSku: '',
      regularPrice: p.regularPrice,
      salePrice: p.salePrice ?? '',
      stockQuantity: p.stockQuantity,
      categories: pCats,
      brand: brandName,
      shortDescription: p.shortDescription,
      imageUrl: p.mainImageUrl,
      attributes: '',
      status: p.status,
    });
    for (const v of vars.filter((vr) => vr.productId === p.id)) {
      rows.push({
        sku: v.sku,
        name: `${p.name} (${(v.attributes || []).map((a) => a.value).join(' / ')})`,
        slug: '',
        productType: 'variation',
        parentSku: p.sku,
        regularPrice: v.regularPrice,
        salePrice: v.salePrice ?? '',
        stockQuantity: v.stockQuantity,
        categories: '',
        brand: '',
        shortDescription: '',
        imageUrl: v.imageUrl,
        attributes: (v.attributes || []).map((a) => `${a.attributeName}:${a.value}`).join('|'),
        status: v.isEnabled ? 'published' : 'draft',
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Catalog');

  if (format === 'xlsx') {
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="kanso-catalog-export.xlsx"');
    return res.send(buf);
  }
  const csv = XLSX.utils.sheet_to_csv(ws);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kanso-catalog-export.csv"');
  res.send(csv);
});

router.post('/import-export/validate', requirePermission('import_export', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided for validation.' });
    }
    const existingProds = await db.select({ sku: products.sku }).from(products);
    const existingVars = await db.select({ sku: productVariations.sku }).from(productVariations);
    const existingSkus = new Set([...existingProds.map((p) => p.sku), ...existingVars.map((v) => v.sku)]);
    const seenBatchSkus = new Set<string>();

    const preview = rows.map((row: any, idx: number) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const sku = String(row.sku || '').trim();
      const name = String(row.name || '').trim();
      const regularPrice = Number(row.regularPrice);

      if (!sku) errors.push('Missing SKU');
      if (!name && row.productType !== 'variation') errors.push('Missing Product Name');
      if (Number.isNaN(regularPrice) || regularPrice < 0) errors.push('Invalid Regular Price');
      if (sku && seenBatchSkus.has(sku)) errors.push(`Duplicate SKU in file: ${sku}`);
      if (sku) seenBatchSkus.add(sku);
      if (sku && existingSkus.has(sku)) warnings.push('SKU exists — will update existing record');

      return {
        rowIndex: idx + 1,
        sku,
        name,
        productType: row.productType || 'simple',
        parentSku: row.parentSku || '',
        regularPrice: Number.isNaN(regularPrice) ? 0 : regularPrice,
        stockQuantity: Number(row.stockQuantity) || 0,
        action: existingSkus.has(sku) ? 'update' : 'create',
        errors,
        warnings,
      };
    });

    res.json({
      totalRows: preview.length,
      errorCount: preview.filter((p) => p.errors.length > 0).length,
      preview,
    });
  } catch (error) {
    res.status(500).json({ error: 'Validation failed.' });
  }
});

router.post('/import-export/commit', requirePermission('import_export', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Invalid rows.' });

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    const allCats = await db.select().from(categories);
    const allBrands = await db.select().from(brands);

    // Pass 1: Simple & Variable parent products
    for (const row of rows.filter((r: any) => r.productType !== 'variation')) {
      try {
        const sku = String(row.sku || '').trim();
        const name = String(row.name || '').trim();
        if (!sku || !name) continue;

        let brandId: number | null = null;
        if (row.brand) {
          const foundBrand = allBrands.find((b) => b.name.toLowerCase() === String(row.brand).trim().toLowerCase());
          if (foundBrand) brandId = foundBrand.id;
        }

        const existing = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
        let prodId: number;
        if (existing.length > 0) {
          const [upd] = await db
            .update(products)
            .set({
              name,
              regularPrice: Number(row.regularPrice) || 0,
              salePrice: row.salePrice !== '' && row.salePrice !== undefined && row.salePrice !== null ? Number(row.salePrice) : null,
              stockQuantity: Number(row.stockQuantity) || 0,
              shortDescription: row.shortDescription ?? existing[0].shortDescription,
              mainImageUrl: row.imageUrl || existing[0].mainImageUrl,
              brandId: brandId ?? existing[0].brandId,
              status: row.status || existing[0].status,
              updatedAt: new Date(),
            })
            .where(eq(products.id, existing[0].id))
            .returning();
          prodId = upd.id;
          updatedCount++;
        } else {
          const baseSlug = slugify(row.slug || name);
          const uniqueSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 899)}`;
          const [cre] = await db
            .insert(products)
            .values({
              sku,
              name,
              slug: uniqueSlug,
              productType: row.productType === 'variable' ? 'variable' : 'simple',
              regularPrice: Number(row.regularPrice) || 0,
              salePrice: row.salePrice !== '' && row.salePrice !== undefined && row.salePrice !== null ? Number(row.salePrice) : null,
              stockQuantity: Number(row.stockQuantity) || 0,
              shortDescription: row.shortDescription || '',
              mainImageUrl: row.imageUrl || '',
              brandId,
              status: row.status || 'published',
            })
            .returning();
          prodId = cre.id;
          createdCount++;
        }

        if (row.categories) {
          const catNames = String(row.categories)
            .split('|')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          const matchedCats = allCats.filter((c) => catNames.includes(c.name.toLowerCase()));
          if (matchedCats.length > 0) {
            await db.delete(productCategories).where(eq(productCategories.productId, prodId));
            await db.insert(productCategories).values(
              matchedCats.map((c, idx) => ({ productId: prodId, categoryId: c.id, isPrimary: idx === 0 }))
            );
          }
        }
      } catch (e: any) {
        errors.push(`SKU ${row.sku}: ${e.message}`);
      }
    }

    // Pass 2: Variations
    for (const row of rows.filter((r: any) => r.productType === 'variation')) {
      try {
        const sku = String(row.sku || '').trim();
        const parentSku = String(row.parentSku || '').trim();
        if (!sku || !parentSku) continue;
        const parentRows = await db.select().from(products).where(eq(products.sku, parentSku)).limit(1);
        if (parentRows.length === 0) {
          errors.push(`Variation ${sku}: parent SKU ${parentSku} not found.`);
          continue;
        }
        const existingVar = await db.select().from(productVariations).where(eq(productVariations.sku, sku)).limit(1);
        if (existingVar.length > 0) {
          await db
            .update(productVariations)
            .set({
              regularPrice: Number(row.regularPrice) || 0,
              salePrice: row.salePrice !== '' && row.salePrice !== undefined && row.salePrice !== null ? Number(row.salePrice) : null,
              stockQuantity: Number(row.stockQuantity) || 0,
              imageUrl: row.imageUrl || existingVar[0].imageUrl,
            })
            .where(eq(productVariations.id, existingVar[0].id));
          updatedCount++;
        } else {
          await db.insert(productVariations).values({
            productId: parentRows[0].id,
            sku,
            regularPrice: Number(row.regularPrice) || 0,
            salePrice: row.salePrice !== '' && row.salePrice !== undefined && row.salePrice !== null ? Number(row.salePrice) : null,
            stockQuantity: Number(row.stockQuantity) || 0,
            imageUrl: row.imageUrl || parentRows[0].mainImageUrl,
            attributes: [],
          });
          createdCount++;
        }
      } catch (e: any) {
        errors.push(`Variation ${row.sku}: ${e.message}`);
      }
    }

    res.json({ createdCount, updatedCount, errors });
  } catch (error) {
    console.error('Import commit error:', error);
    res.status(500).json({ error: 'Bulk import failed.' });
  }
});

// ============================================================================
// 9. MEDIA LIBRARY, SEO, REDIRECTS, PAGES, EMAIL TEMPLATES, USERS & SETTINGS
// ============================================================================

router.get('/media', requirePermission('media', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(mediaLibrary).orderBy(desc(mediaLibrary.createdAt));
  res.json({ media: rows });
});

router.post('/media/upload', requirePermission('media', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { filename, dataUrl, url, altText = '', folder = 'general' } = req.body;
    let finalUrl = url || '';
    let sizeBytes = 0;
    let mimeType = 'image/jpeg';

    if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: 'Invalid image data format.' });
      mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      sizeBytes = buffer.length;
      if (sizeBytes > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image size exceeds 5MB upload limit.' });
      }
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') || 'jpg';
      const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, safeName), buffer);
      finalUrl = `/uploads/${safeName}`;
    }

    if (!finalUrl) return res.status(400).json({ error: 'Image file or URL is required.' });

    const [created] = await db
      .insert(mediaLibrary)
      .values({
        filename: filename || path.basename(finalUrl),
        url: finalUrl,
        thumbnailUrl: finalUrl,
        altText,
        mimeType,
        sizeBytes,
        folder,
      })
      .returning();

    res.status(201).json({ media: created });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ error: 'Failed to upload media.' });
  }
});

router.delete('/media/:id', requirePermission('media', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(mediaLibrary).where(eq(mediaLibrary.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.get('/seo', requirePermission('seo', 'canView'), async (_req: AuthRequest, res: Response) => {
  const redirects = await db.select().from(urlRedirects).orderBy(desc(urlRedirects.createdAt));
  const meta = await db.select().from(seoMetadata);
  const allSettings = await getAllSettings();
  res.json({ redirects, metadata: meta, seoSettings: allSettings.seo });
});

router.post('/redirects', requirePermission('seo', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { sourcePath, targetPath, statusCode = 301 } = req.body;
    const [created] = await db
      .insert(urlRedirects)
      .values({
        sourcePath: sourcePath.startsWith('/') ? sourcePath : `/${sourcePath}`,
        targetPath: targetPath.startsWith('/') ? targetPath : `/${targetPath}`,
        statusCode: Number(statusCode) || 301,
        isActive: true,
      })
      .returning();
    res.status(201).json({ redirect: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create redirect.' });
  }
});

router.delete('/redirects/:id', requirePermission('seo', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(urlRedirects).where(eq(urlRedirects.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.get('/pages', requirePermission('pages', 'canView'), async (_req: AuthRequest, res: Response) => {
  const rows = await db.select().from(websitePages).orderBy(asc(websitePages.sortOrder));
  res.json({ pages: rows });
});

router.post('/pages', requirePermission('pages', 'canCreate'), async (req: AuthRequest, res: Response) => {
  const d = req.body;
  const [created] = await db
    .insert(websitePages)
    .values({
      title: d.title,
      slug: slugify(d.slug || d.title),
      content: d.content || '',
      seoTitle: d.seoTitle || '',
      metaDescription: d.metaDescription || '',
      isPublished: d.isPublished !== false,
      sortOrder: Number(d.sortOrder) || 0,
    })
    .returning();
  res.status(201).json({ page: created });
});

router.put('/pages/:id', requirePermission('pages', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const d = req.body;
  const [updated] = await db
    .update(websitePages)
    .set({
      title: d.title,
      slug: slugify(d.slug || d.title),
      content: d.content || '',
      seoTitle: d.seoTitle || '',
      metaDescription: d.metaDescription || '',
      isPublished: d.isPublished !== false,
      sortOrder: Number(d.sortOrder) || 0,
      updatedAt: new Date(),
    })
    .where(eq(websitePages.id, Number(req.params.id)))
    .returning();
  res.json({ page: updated });
});

router.delete('/pages/:id', requirePermission('pages', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(websitePages).where(eq(websitePages.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.get('/email-templates', requirePermission('email_templates', 'canView'), async (_req: AuthRequest, res: Response) => {
  try {
    const { ensureDefaultEmailTemplates, DEFAULT_EMAIL_TEMPLATES, DEFAULT_EMAIL_SETTINGS } = await import('../../services/platform.ts');
    await ensureDefaultEmailTemplates();
    const templates = await db.select().from(emailTemplates).orderBy(asc(emailTemplates.id));
    const logs = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(60);
    const allSettings = await getAllSettings();
    res.json({
      templates,
      notifications: logs,
      emailSettings: allSettings.email,
      generalSettings: allSettings.general,
      defaultTemplates: DEFAULT_EMAIL_TEMPLATES,
      defaultEmailSettings: DEFAULT_EMAIL_SETTINGS,
    });
  } catch (error: any) {
    console.error('Load email templates error:', error);
    res.status(500).json({ error: error?.message || 'Failed to load email templates.' });
  }
});

router.post('/email-templates/restore-defaults', requirePermission('email_templates', 'canEdit'), async (_req: AuthRequest, res: Response) => {
  try {
    const { ensureDefaultEmailTemplates } = await import('../../services/platform.ts');
    await ensureDefaultEmailTemplates();
    const templates = await db.select().from(emailTemplates).orderBy(asc(emailTemplates.id));
    res.json({ templates });
  } catch (error: any) {
    console.error('Restore email templates error:', error);
    res.status(500).json({ error: error?.message || 'Failed to restore default email templates.' });
  }
});

router.post('/email-templates', requirePermission('email_templates', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const baseSlug = slugify(d.slug || d.name || d.triggerEvent || `template-${Date.now()}`);
    const [created] = await db
      .insert(emailTemplates)
      .values({
        slug: `${baseSlug}-${Date.now().toString().slice(-4)}`,
        name: String(d.name || 'Custom Email Template').trim(),
        subject: String(d.subject || 'Update from {{siteName}}'),
        bodyHtml: String(d.bodyHtml || '<p>Hello {{customerName}},</p>'),
        triggerEvent: String(d.triggerEvent || 'custom.event').trim(),
        isActive: d.isActive !== false,
      })
      .returning();
    res.status(201).json({ template: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create template.' });
  }
});

router.put('/email-templates/:id', requirePermission('email_templates', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const d = req.body;
    const [updated] = await db
      .update(emailTemplates)
      .set({
        name: d.name,
        subject: d.subject,
        bodyHtml: d.bodyHtml,
        triggerEvent: d.triggerEvent || undefined,
        isActive: d.isActive !== false,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, Number(req.params.id)))
      .returning();

    if (updated && (d.customColors !== undefined || d.resetColors)) {
      const allSettings = await getAllSettings();
      const currentEmail = allSettings.email || {};
      const nextTemplateColors = { ...(currentEmail.templateColors || {}) };
      if (d.resetColors || !d.customColors || Object.keys(d.customColors).length === 0) {
        delete nextTemplateColors[updated.triggerEvent];
      } else {
        nextTemplateColors[updated.triggerEvent] = d.customColors;
      }
      const nextEmailValue = {
        ...currentEmail,
        templateColors: nextTemplateColors,
      };
      await db
        .insert(settings)
        .values({ key: 'email', category: 'email', value: nextEmailValue, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: nextEmailValue, updatedAt: new Date() },
        });
    }

    const latestSettings = await getAllSettings();
    res.json({ template: updated, emailSettings: latestSettings.email });
  } catch (error: any) {
    console.error('Update email template error:', error);
    res.status(500).json({ error: error?.message || 'Failed to update email template.' });
  }
});

router.delete('/email-templates/:id', requirePermission('email_templates', 'canDelete'), async (req: AuthRequest, res: Response) => {
  await db.delete(emailTemplates).where(eq(emailTemplates.id, Number(req.params.id)));
  res.json({ deleted: true });
});

router.post('/email-templates/preview', requirePermission('email_templates', 'canView'), async (req: AuthRequest, res: Response) => {
  const { renderBrandedEmail } = await import('../../services/platform.ts');
  const allSettings = await getAllSettings();
  const { subject, bodyHtml, emailSettings, eventLabel, variables, templateKey } = req.body;
  const sampleVars: Record<string, string> = {
    customerName: 'Elena Vance',
    email: 'elena.vance@nordicarch.co',
    orderNumber: 'KA-2026-1048',
    totalAmount: '$998.20',
    orderStatus: 'shipped',
    paymentStatus: 'unpaid',
    inquiryRef: 'INQ-2026-412',
    quoteRef: 'QT-2026-815',
    grandTotal: '$11,838.00',
    status: 'accepted',
    quoteUrl: `${process.env.APP_URL || 'https://kansoatelier.com'}/quotation/QT-2026-815?token=preview`,
    ...(variables || {}),
  };
  const rendered = renderBrandedEmail({
    subjectTemplate: subject || 'Preview Email',
    bodyHtmlTemplate: bodyHtml || '',
    emailSettings: emailSettings || allSettings.email,
    generalSettings: allSettings.general,
    variables: sampleVars,
    eventLabel: eventLabel || 'Email Preview',
    templateKey,
  });
  res.json(rendered);
});

router.post('/email-templates/:id/test', requirePermission('email_templates', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Template not found.' });
  const tmpl = rows[0];
  const allSettings = await getAllSettings();
  const recipient = String(
    req.body.recipientEmail || req.dbUser?.email || allSettings.email?.adminNotificationEmail || 'studio@kansoatelier.com'
  ).trim();
  const log = await dispatchNotification(
    tmpl.triggerEvent,
    recipient,
    {
      customerName: req.dbUser?.displayName || 'Elena Vance',
      email: recipient,
      orderNumber: 'KA-TEST-2026',
      totalAmount: '$640.00',
      orderStatus: 'processing',
      paymentStatus: 'unpaid',
      inquiryRef: 'INQ-TEST-101',
      quoteRef: 'QT-TEST-801',
      grandTotal: '$4,250.00',
      status: 'accepted',
      quoteUrl: `${process.env.APP_URL || 'https://kansoatelier.com'}/quotation/QT-TEST-801?token=demo`,
    },
    'test_email',
    tmpl.id,
    { force: true }
  );
  res.json({ dispatched: log });
});

router.get('/users', requirePermission('users', 'canView'), async (_req: AuthRequest, res: Response) => {
  const userRows = await db.select().from(users).orderBy(asc(users.id));
  const roleRows = await db.select().from(roles).orderBy(asc(roles.id));
  const permRows = await db.select().from(permissions);
  res.json({
    users: userRows,
    roles: roleRows.map((r) => ({
      ...r,
      permissions: permRows.filter((p) => p.roleId === r.id),
    })),
  });
});

router.put('/users/:id', requirePermission('users', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const { roleId, isActive } = req.body;
  const [updated] = await db
    .update(users)
    .set({
      roleId: roleId ? Number(roleId) : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, Number(req.params.id)))
    .returning();
  res.json({ user: updated });
});

router.put('/roles/:id/permissions', requirePermission('users', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const roleId = Number(req.params.id);
  const { perms } = req.body;
  if (!Array.isArray(perms)) return res.status(400).json({ error: 'Invalid permissions payload.' });
  await db.delete(permissions).where(eq(permissions.roleId, roleId));
  if (perms.length > 0) {
    await db.insert(permissions).values(
      perms.map((p: any) => ({
        roleId,
        module: p.module,
        canView: Boolean(p.canView),
        canCreate: Boolean(p.canCreate),
        canEdit: Boolean(p.canEdit),
        canDelete: Boolean(p.canDelete),
      }))
    );
  }
  res.json({ updated: true });
});

router.get('/settings', requirePermission('settings', 'canView'), async (_req: AuthRequest, res: Response) => {
  const all = await getAllSettings();
  res.json({ settings: all });
});

router.put('/settings/:key', requirePermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const value = req.body.value;
    await db
      .insert(settings)
      .values({ key, category: key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });
    const all = await getAllSettings();
    res.json({ settings: all });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

export default router;
