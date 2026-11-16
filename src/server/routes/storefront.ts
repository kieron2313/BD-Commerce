import { Router, Request, Response } from 'express';
import { db } from '../../db/index.ts';
import {
  products,
  productVariations,
  productCategories,
  categories,
  brands,
  attributes,
  attributeValues,
  carts,
  cartItems,
  shippingMethods,
  shippingZones,
  orders,
  orderItems,
  orderHistory,
  couponUsage,
  coupons,
  inquiries,
  inquiryItems,
  quotations,
  quotationItems,
  websitePages,
  customers,
  urlRedirects,
} from '../../db/schema.ts';
import { eq, desc, asc, inArray, and, sql } from 'drizzle-orm';
import {
  getAllSettings,
  resolveEffectiveProductFlags,
  getEffectivePrice,
  validateAndCalculateCoupon,
  isShippingMethodEligible,
  extractConfiguredShippingCountries,
  dispatchNotification,
  upsertCustomerFromCheckout,
  generateUniqueRef,
  adjustStockAndLog,
  getProductCategoryIdsMap,
  roundMoney,
} from '../../services/platform.ts';
import { ensureSeeded } from '../../db/seed.ts';
import { optionalAuth, requireAuth, AuthRequest } from '../../middleware/auth.ts';
import crypto from 'crypto';

const router = Router();

function getSessionId(req: Request, res: Response): string {
  const headerId = req.headers['x-session-id'];
  if (typeof headerId === 'string' && headerId.length >= 8 && headerId.length <= 128) {
    return headerId;
  }
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/ka_session=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  const newId = crypto.randomBytes(16).toString('hex');
  res.setHeader(
    'Set-Cookie',
    `ka_session=${newId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
  );
  return newId;
}

async function getOrCreateCart(sessionId: string) {
  const existing = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db
    .insert(carts)
    .values({ sessionId })
    .onConflictDoUpdate({
      target: carts.sessionId,
      set: { updatedAt: new Date() },
    })
    .returning();
  return created;
}

async function hydrateCart(cartId: number, allSettings: Awaited<ReturnType<typeof getAllSettings>>) {
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId)).orderBy(asc(cartItems.id));
  if (items.length === 0) {
    return { items: [], subtotal: 0, itemCount: 0 };
  }
  const prodIds = [...new Set(items.map((i) => i.productId))];
  const varIds = [...new Set(items.map((i) => i.variationId).filter((v): v is number => v !== null))];

  const prodRows = await db.select().from(products).where(inArray(products.id, prodIds));
  const prodMap = new Map(prodRows.map((p) => [p.id, p]));

  const varRows =
    varIds.length > 0
      ? await db.select().from(productVariations).where(inArray(productVariations.id, varIds))
      : [];
  const varMap = new Map(varRows.map((v) => [v.id, v]));

  const catIdsMap = await getProductCategoryIdsMap(prodIds);
  const allCats = await db.select().from(categories);
  const catMap = new Map(allCats.map((c) => [c.id, c]));

  let subtotal = 0;
  let itemCount = 0;

  const hydratedItems = items
    .map((item) => {
      const prod = prodMap.get(item.productId);
      if (!prod) return null;
      const variation = item.variationId ? varMap.get(item.variationId) : undefined;
      const pCatIds = catIdsMap.get(prod.id) || [];
      const pCats = pCatIds.map((cid) => catMap.get(cid)).filter((c): c is NonNullable<typeof c> => Boolean(c));
      const flags = resolveEffectiveProductFlags(prod, pCats, allSettings);

      const priceInfo = variation
        ? getEffectivePrice(variation.regularPrice, variation.salePrice, variation.saleStartDate, variation.saleEndDate)
        : getEffectivePrice(prod.regularPrice, prod.salePrice, prod.saleStartDate, prod.saleEndDate);

      const lineTotal = roundMoney(priceInfo.unitPrice * item.quantity);
      subtotal += lineTotal;
      itemCount += item.quantity;

      const variationLabel =
        variation?.attributes?.map((a) => `${a.attributeName}: ${a.value}`).join(' · ') ||
        item.selectedAttributes?.map((a) => `${a.attributeName}: ${a.value}`).join(' · ') ||
        '';

      return {
        id: item.id,
        productId: prod.id,
        productName: prod.name,
        productSlug: prod.slug,
        variationId: variation?.id || null,
        sku: variation?.sku || prod.sku,
        imageUrl: variation?.imageUrl || prod.mainImageUrl || '',
        variationLabel,
        selectedAttributes: variation?.attributes || item.selectedAttributes || [],
        quantity: item.quantity,
        stockQuantity: variation ? variation.stockQuantity : prod.stockQuantity,
        stockStatus: variation ? variation.stockStatus : prod.stockStatus,
        unitPrice: flags.showPrices ? priceInfo.unitPrice : null,
        regularPrice: flags.showPrices ? priceInfo.regularPrice : null,
        lineTotal: flags.showPrices ? lineTotal : null,
        showPrices: flags.showPrices,
        showSku: flags.showSku,
        categoryIds: pCatIds,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  return {
    items: hydratedItems,
    subtotal: roundMoney(subtotal),
    itemCount,
  };
}

// Bootstrap public configuration, navigation tree, and active session cart
router.get('/bootstrap', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const sessionId = getSessionId(req, res);
    const allSettings = await getAllSettings();
    const allCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.status, 'active'))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    const allBrands = await db
      .select()
      .from(brands)
      .where(eq(brands.status, 'active'))
      .orderBy(asc(brands.name));
    const allAttributes = await db.select().from(attributes).orderBy(asc(attributes.sortOrder));
    const allAttrValues = await db
      .select()
      .from(attributeValues)
      .orderBy(asc(attributeValues.sortOrder));
    const pages = await db
      .select({
        id: websitePages.id,
        title: websitePages.title,
        slug: websitePages.slug,
        sortOrder: websitePages.sortOrder,
      })
      .from(websitePages)
      .where(eq(websitePages.isPublished, true))
      .orderBy(asc(websitePages.sortOrder));

    const cart = await getOrCreateCart(sessionId);
    const hydrated = await hydrateCart(cart.id, allSettings);

    const attrsWithValues = allAttributes.map((attr) => ({
      ...attr,
      values: allAttrValues.filter((v) => v.attributeId === attr.id),
    }));

    const activeRedirects = await db
      .select({
        sourcePath: urlRedirects.sourcePath,
        targetPath: urlRedirects.targetPath,
      })
      .from(urlRedirects)
      .where(eq(urlRedirects.isActive, true));

    res.json({
      sessionId,
      settings: allSettings,
      categories: allCategories,
      brands: allBrands,
      attributes: attrsWithValues,
      pages,
      redirects: activeRedirects,
      cart: {
        id: cart.id,
        couponCode: cart.couponCode || '',
        shippingMethodId: cart.shippingMethodId || null,
        ...hydrated,
      },
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Failed to load storefront configuration.' });
  }
});

// AJAX Category Tree & Live Product Counts
router.get('/categories/tree', async (_req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const allCats = await db
      .select()
      .from(categories)
      .where(eq(categories.status, 'active'))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    const publishedProds = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.status, 'published'));
    const pubIds = publishedProds.map((p) => p.id);
    const prodCatRows =
      pubIds.length > 0
        ? await db
            .select()
            .from(productCategories)
            .where(inArray(productCategories.productId, pubIds))
        : [];

    const directMap = new Map<number, Set<number>>();
    for (const row of prodCatRows) {
      const set = directMap.get(row.categoryId) || new Set<number>();
      set.add(row.productId);
      directMap.set(row.categoryId, set);
    }

    const collectDescendantIds = (catId: number): number[] => {
      const ids = [catId];
      for (const c of allCats) {
        if (c.parentId === catId) {
          ids.push(...collectDescendantIds(c.id));
        }
      }
      return ids;
    };

    const enriched = allCats.map((c) => {
      const descIds = collectDescendantIds(c.id);
      const uniqueProds = new Set<number>();
      for (const cid of descIds) {
        for (const pid of directMap.get(cid) || []) {
          uniqueProds.add(pid);
        }
      }
      return {
        ...c,
        productCount: uniqueProds.size,
      };
    });

    res.json({ categories: enriched, totalProducts: pubIds.length });
  } catch (error) {
    console.error('Category tree error:', error);
    res.status(500).json({ error: 'Failed to load category tree.' });
  }
});

// AJAX Subcategories Loader for a Main Category
router.get('/categories/:slug/subcategories', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { slug } = req.params;
    const allCats = await db
      .select()
      .from(categories)
      .where(eq(categories.status, 'active'))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    const parent = allCats.find((c) => c.slug === slug || String(c.id) === slug);
    if (!parent) {
      return res.status(404).json({ error: 'Category not found.', subcategories: [] });
    }

    const publishedProds = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.status, 'published'));
    const pubIds = publishedProds.map((p) => p.id);
    const prodCatRows =
      pubIds.length > 0
        ? await db
            .select()
            .from(productCategories)
            .where(inArray(productCategories.productId, pubIds))
        : [];

    const directMap = new Map<number, Set<number>>();
    for (const row of prodCatRows) {
      const set = directMap.get(row.categoryId) || new Set<number>();
      set.add(row.productId);
      directMap.set(row.categoryId, set);
    }

    const descendants: Array<typeof allCats[number] & { depth: number; productCount: number }> = [];
    const walk = (pid: number, depth: number) => {
      const kids = allCats.filter((c) => c.parentId === pid);
      for (const k of kids) {
        const countSet = new Set<number>(directMap.get(k.id) || []);
        const gatherChildProds = (cid: number) => {
          for (const sub of allCats.filter((x) => x.parentId === cid)) {
            for (const p of directMap.get(sub.id) || []) countSet.add(p);
            gatherChildProds(sub.id);
          }
        };
        gatherChildProds(k.id);
        descendants.push({
          ...k,
          depth,
          productCount: countSet.size,
        });
        walk(k.id, depth + 1);
      }
    };
    walk(parent.id, 0);

    res.json({ parent, subcategories: descendants });
  } catch (error) {
    console.error('Subcategories load error:', error);
    res.status(500).json({ error: 'Failed to load subcategories.' });
  }
});

// Check redirect rules
router.get('/redirect-check', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const path = String(req.query.path || '');
    if (!path) return res.json({ redirect: null });
    const rows = await db
      .select()
      .from(urlRedirects)
      .where(and(eq(urlRedirects.sourcePath, path), eq(urlRedirects.isActive, true)))
      .limit(1);
    if (rows.length > 0) {
      await db
        .update(urlRedirects)
        .set({ hits: rows[0].hits + 1 })
        .where(eq(urlRedirects.id, rows[0].id));
      return res.json({ redirect: rows[0] });
    }
    res.json({ redirect: null });
  } catch (error) {
    console.error('Redirect check error:', error);
    res.json({ redirect: null });
  }
});

// Product Listing with full search & multi-filter support
router.get('/products', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const allSettings = await getAllSettings();
    const {
      q = '',
      category = '',
      brand = '',
      attrs = '',
      minPrice = '',
      maxPrice = '',
      availability = '',
      featured = '',
      isNew = '',
      sort = 'featured',
      page = '1',
      limit = '12',
    } = req.query as Record<string, string>;

    const allProds = await db
      .select()
      .from(products)
      .where(eq(products.status, 'published'));
    const allCats = await db.select().from(categories);
    const catById = new Map(allCats.map((c) => [c.id, c]));
    const catBySlug = new Map(allCats.map((c) => [c.slug, c]));

    const allBrands = await db.select().from(brands);
    const brandById = new Map(allBrands.map((b) => [b.id, b]));
    const brandBySlug = new Map(allBrands.map((b) => [b.slug, b]));

    const prodIds = allProds.map((p) => p.id);
    const prodCatMap = await getProductCategoryIdsMap(prodIds);
    const allVars =
      prodIds.length > 0
        ? await db
            .select()
            .from(productVariations)
            .where(and(inArray(productVariations.productId, prodIds), eq(productVariations.isEnabled, true)))
        : [];
    const varsByProd = new Map<number, typeof allVars>();
    for (const v of allVars) {
      const list = varsByProd.get(v.productId) || [];
      list.push(v);
      varsByProd.set(v.productId, list);
    }

    // Collect descendant category IDs if filtering by parent category
    let allowedCatIds: Set<number> | null = null;
    if (category) {
      const targetCat = catBySlug.get(category) || (Number(category) ? catById.get(Number(category)) : undefined);
      if (targetCat) {
        allowedCatIds = new Set<number>([targetCat.id]);
        const collectChildren = (parentId: number) => {
          for (const c of allCats) {
            if (c.parentId === parentId && !allowedCatIds!.has(c.id)) {
              allowedCatIds!.add(c.id);
              collectChildren(c.id);
            }
          }
        };
        collectChildren(targetCat.id);
      } else {
        allowedCatIds = new Set<number>([-1]);
      }
    }

    const filterBrand = brand ? brandBySlug.get(brand) || (Number(brand) ? brandById.get(Number(brand)) : undefined) : undefined;
    const attrFilterValueIds = attrs
      ? attrs
          .split(',')
          .map((n) => Number(n.trim()))
          .filter((n) => !Number.isNaN(n) && n > 0)
      : [];

    const searchLower = q.trim().toLowerCase();

    const enriched = allProds
      .map((p) => {
        const cIds = prodCatMap.get(p.id) || [];
        const pCats = cIds.map((id) => catById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
        const pBrand = p.brandId ? brandById.get(p.brandId) || null : null;
        const pVars = varsByProd.get(p.id) || [];
        const flags = resolveEffectiveProductFlags(p, pCats, allSettings);

        let effectiveRegular = p.regularPrice;
        let effectiveSale = p.salePrice;
        let effectiveUnit = getEffectivePrice(p.regularPrice, p.salePrice, p.saleStartDate, p.saleEndDate).unitPrice;
        let totalStock = p.stockQuantity;
        let inStock = p.stockQuantity > 0 || p.allowBackorder || p.stockStatus === 'in_stock';

        let defaultVariationId: number | null = null;
        let defaultSelectedAttributes: Array<{
          attributeId: number;
          attributeName: string;
          attributeSlug: string;
          valueId: number;
          value: string;
          colorHex?: string;
        }> = [];

        if (p.productType === 'variable' && pVars.length > 0) {
          const prices = pVars.map((v) =>
            getEffectivePrice(v.regularPrice, v.salePrice, v.saleStartDate, v.saleEndDate)
          );
          prices.sort((a, b) => a.unitPrice - b.unitPrice);
          effectiveUnit = prices[0].unitPrice;
          effectiveRegular = prices[0].regularPrice;
          effectiveSale = prices[0].salePrice;
          totalStock = pVars.reduce((sum, v) => sum + v.stockQuantity, 0);
          inStock = pVars.some((v) => v.stockQuantity > 0 || v.backorderStatus !== 'no');

          const bestVar =
            pVars.find((v) => v.stockQuantity > 0 || v.backorderStatus !== 'no') || pVars[0];
          defaultVariationId = bestVar.id;
          defaultSelectedAttributes = bestVar.attributes || [];
        }

        // Collect all attribute value IDs on this product or its variations
        const prodAttrValueIds = new Set<number>();
        for (const a of p.assignedAttributes || []) {
          for (const vid of a.valueIds || []) prodAttrValueIds.add(vid);
        }
        for (const v of pVars) {
          for (const va of v.attributes || []) prodAttrValueIds.add(va.valueId);
        }

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: flags.showSku ? p.sku : '',
          shortDescription: p.shortDescription,
          mainImageUrl: p.mainImageUrl,
          imageAlt: p.imageAlt || p.name,
          productType: p.productType,
          isFeatured: p.isFeatured,
          isNew: p.isNew,
          brand: pBrand ? { id: pBrand.id, name: pBrand.name, slug: pBrand.slug } : null,
          categories: pCats.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
          regularPrice: flags.showPrices ? effectiveRegular : null,
          salePrice: flags.showPrices && flags.showSalePrices ? effectiveSale : null,
          unitPrice: flags.showPrices ? effectiveUnit : null,
          _rawPrice: effectiveUnit,
          stockQuantity: flags.showStock ? totalStock : null,
          stockStatus: inStock ? 'in_stock' : 'out_of_stock',
          inStock,
          variationCount: pVars.length,
          defaultVariationId,
          defaultSelectedAttributes,
          variationsPreview: pVars.slice(0, 5).map((v) => ({
            id: v.id,
            attributes: v.attributes,
          })),
          flags,
          _attrValueIds: prodAttrValueIds,
          _cIds: cIds,
          createdAt: p.createdAt,
        };
      })
      .filter((item) => {
        if (featured === 'true' && !item.isFeatured) return false;
        if (isNew === 'true' && !item.isNew) return false;
        if (allowedCatIds && !item._cIds.some((id) => allowedCatIds!.has(id))) return false;
        if (brand && (!item.brand || item.brand.id !== filterBrand?.id)) return false;
        if (availability === 'in_stock' && !item.inStock) return false;
        if (availability === 'out_of_stock' && item.inStock) return false;
        if (attrFilterValueIds.length > 0) {
          const matchesAny = attrFilterValueIds.some((vid) => item._attrValueIds.has(vid));
          if (!matchesAny) return false;
        }
        if (minPrice && Number(minPrice) > 0 && item.flags.showPrices) {
          if (item._rawPrice < Number(minPrice)) return false;
        }
        if (maxPrice && Number(maxPrice) > 0 && item.flags.showPrices) {
          if (item._rawPrice > Number(maxPrice)) return false;
        }
        if (searchLower) {
          const hay = [
            item.name,
            item.sku,
            item.shortDescription,
            item.brand?.name || '',
            ...item.categories.map((c) => c.name),
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(searchLower)) return false;
        }
        return true;
      });

    // Sort
    enriched.sort((a, b) => {
      if (sort === 'price_asc') return a._rawPrice - b._rawPrice;
      if (sort === 'price_desc') return b._rawPrice - a._rawPrice;
      if (sort === 'name_asc') return a.name.localeCompare(b.name);
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      // featured default
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return b.id - a.id;
    });

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(48, Math.max(1, Number(limit) || 12));
    const total = enriched.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const sliced = enriched.slice((pageNum - 1) * limitNum, pageNum * limitNum).map((item) => {
      const { _rawPrice, _attrValueIds, _cIds, ...publicItem } = item;
      return publicItem;
    });

    res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=60');
    res.json({
      products: sliced,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ error: 'Failed to load products.' });
  }
});

// Instant Live AJAX Search Engine endpoint
router.get('/search/instant', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const allSettings = await getAllSettings();
    const q = String(req.query.q || '').trim();
    const categorySlug = String(req.query.category || '').trim();
    const limitNum = Math.min(12, Math.max(1, Number(req.query.limit) || 6));
    const searchLower = q.toLowerCase();

    const [allProds, allCats, allBrands] = await Promise.all([
      db.select().from(products).where(eq(products.status, 'published')),
      db
        .select()
        .from(categories)
        .where(eq(categories.status, 'active'))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db.select().from(brands).where(eq(brands.status, 'active')).orderBy(asc(brands.name)),
    ]);

    const catById = new Map(allCats.map((c) => [c.id, c]));
    const catBySlug = new Map(allCats.map((c) => [c.slug, c]));
    const brandById = new Map(allBrands.map((b) => [b.id, b]));

    const prodIds = allProds.map((p) => p.id);
    const prodCatMap = await getProductCategoryIdsMap(prodIds);
    const allVars =
      prodIds.length > 0
        ? await db
            .select()
            .from(productVariations)
            .where(and(inArray(productVariations.productId, prodIds), eq(productVariations.isEnabled, true)))
        : [];
    const varsByProd = new Map<number, typeof allVars>();
    for (const v of allVars) {
      const list = varsByProd.get(v.productId) || [];
      list.push(v);
      varsByProd.set(v.productId, list);
    }

    let allowedCatIds: Set<number> | null = null;
    if (categorySlug) {
      const targetCat = catBySlug.get(categorySlug);
      if (targetCat) {
        allowedCatIds = new Set<number>([targetCat.id]);
        const collectChildren = (pid: number) => {
          for (const c of allCats) {
            if (c.parentId === pid && !allowedCatIds!.has(c.id)) {
              allowedCatIds!.add(c.id);
              collectChildren(c.id);
            }
          }
        };
        collectChildren(targetCat.id);
      }
    }

    const scoredProducts = allProds
      .map((p) => {
        const cIds = prodCatMap.get(p.id) || [];
        if (allowedCatIds && !cIds.some((id) => allowedCatIds!.has(id))) {
          return null;
        }
        const pCats = cIds
          .map((id) => catById.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c));
        const pBrand = p.brandId ? brandById.get(p.brandId) || null : null;
        const pVars = varsByProd.get(p.id) || [];
        const flags = resolveEffectiveProductFlags(p, pCats, allSettings);

        let effectiveRegular = p.regularPrice;
        let effectiveSale = p.salePrice;
        let effectiveUnit = getEffectivePrice(p.regularPrice, p.salePrice, p.saleStartDate, p.saleEndDate).unitPrice;
        let inStock = p.stockQuantity > 0 || p.allowBackorder || p.stockStatus === 'in_stock';
        let defaultVariationId: number | null = null;
        let defaultSelectedAttributes: typeof allVars[number]['attributes'] = [];

        if (p.productType === 'variable' && pVars.length > 0) {
          const prices = pVars.map((v) =>
            getEffectivePrice(v.regularPrice, v.salePrice, v.saleStartDate, v.saleEndDate)
          );
          prices.sort((a, b) => a.unitPrice - b.unitPrice);
          effectiveUnit = prices[0].unitPrice;
          effectiveRegular = prices[0].regularPrice;
          effectiveSale = prices[0].salePrice;
          inStock = pVars.some((v) => v.stockQuantity > 0 || v.backorderStatus !== 'no');
          const bestVar = pVars.find((v) => v.stockQuantity > 0 || v.backorderStatus !== 'no') || pVars[0];
          defaultVariationId = bestVar.id;
          defaultSelectedAttributes = bestVar.attributes || [];
        }

        let score = 0;
        if (!searchLower) {
          score = p.isFeatured ? 50 : p.isNew ? 35 : 10;
        } else {
          const nameL = p.name.toLowerCase();
          const skuL = (p.sku || '').toLowerCase();
          const shortL = (p.shortDescription || '').toLowerCase();
          const fullL = (p.fullDescription || '').toLowerCase();
          const brandL = (pBrand?.name || '').toLowerCase();
          const catText = pCats.map((c) => c.name.toLowerCase()).join(' ');
          const varText = pVars
            .map((v) => `${v.sku} ${(v.attributes || []).map((a) => a.value).join(' ')}`)
            .join(' ')
            .toLowerCase();
          const tagsText = (p.tags || []).join(' ').toLowerCase();

          if (skuL === searchLower) score += 120;
          else if (skuL.includes(searchLower)) score += 75;
          if (nameL.startsWith(searchLower)) score += 100;
          else if (nameL.includes(searchLower)) score += 70;
          if (brandL.includes(searchLower)) score += 45;
          if (catText.includes(searchLower)) score += 40;
          if (varText.includes(searchLower)) score += 35;
          if (tagsText.includes(searchLower)) score += 30;
          if (shortL.includes(searchLower)) score += 25;
          if (fullL.includes(searchLower)) score += 12;
        }

        if (score <= 0) return null;

        return {
          score,
          item: {
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku: flags.showSku ? p.sku : '',
            shortDescription: p.shortDescription,
            mainImageUrl: p.mainImageUrl,
            imageAlt: p.imageAlt || p.name,
            productType: p.productType,
            isFeatured: p.isFeatured,
            isNew: p.isNew,
            brand: pBrand ? { id: pBrand.id, name: pBrand.name, slug: pBrand.slug } : null,
            categories: pCats.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
            regularPrice: flags.showPrices ? effectiveRegular : null,
            salePrice: flags.showPrices && flags.showSalePrices ? effectiveSale : null,
            unitPrice: flags.showPrices ? effectiveUnit : null,
            inStock,
            variationCount: pVars.length,
            defaultVariationId,
            defaultSelectedAttributes,
            flags,
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score || b.item.id - a.item.id);

    const matchingCategories = searchLower
      ? allCats
          .filter(
            (c) =>
              c.name.toLowerCase().includes(searchLower) ||
              (c.description || '').toLowerCase().includes(searchLower)
          )
          .slice(0, 4)
      : allCats.filter((c) => !c.parentId).slice(0, 4);

    const matchingBrands = searchLower
      ? allBrands.filter((b) => b.name.toLowerCase().includes(searchLower)).slice(0, 4)
      : allBrands.slice(0, 4);

    const suggestions = Array.from(
      new Set([
        ...allCats.filter((c) => !c.parentId).map((c) => c.name),
        ...allCats.filter((c) => c.parentId).slice(0, 3).map((c) => c.name),
        ...allProds.filter((p) => p.isFeatured).map((p) => p.name.split(' ').slice(0, 2).join(' ')),
      ])
    ).slice(0, 6);

    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
    res.json({
      query: q,
      totalMatches: scoredProducts.length,
      products: scoredProducts.slice(0, limitNum).map((x) => x.item),
      categories: matchingCategories,
      brands: matchingBrands,
      suggestions,
    });
  } catch (error) {
    console.error('Instant search error:', error);
    res.status(500).json({ error: 'Failed to search catalog.' });
  }
});

// Single Product Detail by Slug
router.get('/products/:slug', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const allSettings = await getAllSettings();
    const { slug } = req.params;
    const rows = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
    if (rows.length === 0 || rows[0].status === 'archived') {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const p = rows[0];
    const pCatLinks = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.productId, p.id));
    const catIds = pCatLinks.map((c) => c.categoryId);
    const allCats = await db.select().from(categories);
    const catMap = new Map(allCats.map((c) => [c.id, c]));
    const pCats = catIds
      .map((id) => catMap.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    // Order primary category first
    const primaryLink = pCatLinks.find((l) => l.isPrimary);
    if (primaryLink) {
      pCats.sort((a, b) => (a.id === primaryLink.categoryId ? -1 : b.id === primaryLink.categoryId ? 1 : 0));
    }

    const flags = resolveEffectiveProductFlags(p, pCats, allSettings);
    const brandRow = p.brandId
      ? (await db.select().from(brands).where(eq(brands.id, p.brandId)).limit(1))[0] || null
      : null;

    const variations = await db
      .select()
      .from(productVariations)
      .where(and(eq(productVariations.productId, p.id), eq(productVariations.isEnabled, true)))
      .orderBy(asc(productVariations.id));

    const allAttrs = await db.select().from(attributes).orderBy(asc(attributes.sortOrder));
    const allVals = await db.select().from(attributeValues).orderBy(asc(attributeValues.sortOrder));

    const productAttributes = (p.assignedAttributes || [])
      .map((assigned) => {
        const attr = allAttrs.find((a) => a.id === assigned.attributeId);
        if (!attr) return null;
        const vals = allVals.filter((v) => assigned.valueIds.includes(v.id));
        return {
          ...attr,
          usedForVariations: assigned.usedForVariations,
          values: vals,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const priceInfo = getEffectivePrice(p.regularPrice, p.salePrice, p.saleStartDate, p.saleEndDate);

    // Related / cross-sell / upsell products
    const relatedIds = [...new Set([...(p.relatedProductIds || []), ...(p.crossSellProductIds || [])])].filter(
      (id) => id !== p.id
    );
    let relatedProducts: Array<Record<string, unknown>> = [];
    if (relatedIds.length > 0) {
      const relRows = await db
        .select()
        .from(products)
        .where(and(inArray(products.id, relatedIds), eq(products.status, 'published')));
      const relCatMap = await getProductCategoryIdsMap(relRows.map((r) => r.id));
      const allBrandsRows = await db.select().from(brands);
      const brandLookup = new Map(allBrandsRows.map((b) => [b.id, b]));
      const relVarsRows = await db
        .select()
        .from(productVariations)
        .where(and(inArray(productVariations.productId, relRows.map((r) => r.id)), eq(productVariations.isEnabled, true)))
        .orderBy(asc(productVariations.id));
      const relVarsByProd = new Map<number, typeof relVarsRows>();
      for (const rv of relVarsRows) {
        const list = relVarsByProd.get(rv.productId) || [];
        list.push(rv);
        relVarsByProd.set(rv.productId, list);
      }
      relatedProducts = relRows.map((rp) => {
        const rpCatIds = relCatMap.get(rp.id) || [];
        const rpCats = rpCatIds
          .map((cid) => catMap.get(cid))
          .filter((c): c is NonNullable<typeof c> => Boolean(c));
        const rpFlags = resolveEffectiveProductFlags(rp, rpCats, allSettings);
        const rpVars = relVarsByProd.get(rp.id) || [];
        let rpUnit = getEffectivePrice(rp.regularPrice, rp.salePrice, rp.saleStartDate, rp.saleEndDate).unitPrice;
        let rpRegular = rp.regularPrice;
        let rpSale = rp.salePrice;
        let rpInStock = rp.stockStatus !== 'out_of_stock' || rp.allowBackorder;
        let rpStockQty = rp.stockQuantity;
        let defaultVariationId: number | null = null;
        let defaultSelectedAttributes: (typeof relVarsRows)[number]['attributes'] = [];

        if (rp.productType === 'variable' && rpVars.length > 0) {
          const prices = rpVars.map((v) =>
            getEffectivePrice(v.regularPrice, v.salePrice, v.saleStartDate, v.saleEndDate)
          );
          prices.sort((a, b) => a.unitPrice - b.unitPrice);
          rpUnit = prices[0].unitPrice;
          rpRegular = prices[0].regularPrice;
          rpSale = prices[0].salePrice;
          rpStockQty = rpVars.reduce((sum, v) => sum + v.stockQuantity, 0);
          rpInStock = rpVars.some((v) => v.stockQuantity > 0 || v.backorderStatus !== 'no');
          const bestVar = rpVars.find((v) => v.stockQuantity > 0 || v.backorderStatus !== 'no') || rpVars[0];
          defaultVariationId = bestVar.id;
          defaultSelectedAttributes = bestVar.attributes || [];
        }
        const rpBrand = rp.brandId ? brandLookup.get(rp.brandId) || null : null;
        return {
          id: rp.id,
          name: rp.name,
          slug: rp.slug,
          sku: rpFlags.showSku ? rp.sku : '',
          mainImageUrl: rp.mainImageUrl,
          imageAlt: rp.imageAlt || rp.name,
          shortDescription: rp.shortDescription,
          productType: rp.productType,
          isFeatured: rp.isFeatured,
          isNew: rp.isNew,
          brand: rpBrand ? { id: rpBrand.id, name: rpBrand.name, slug: rpBrand.slug } : null,
          categories: rpCats.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
          unitPrice: rpFlags.showPrices ? rpUnit : null,
          regularPrice: rpFlags.showPrices ? rpRegular : null,
          salePrice: rpFlags.showPrices && rpFlags.showSalePrices ? rpSale : null,
          stockQuantity: rpFlags.showStock ? rpStockQty : null,
          stockStatus: rpInStock ? 'in_stock' : 'out_of_stock',
          inStock: rpInStock,
          variationCount: rpVars.length,
          defaultVariationId,
          defaultSelectedAttributes,
          flags: rpFlags,
        };
      });
    }

    // Build category breadcrumb trail
    const breadcrumbs: Array<{ name: string; path: string }> = [{ name: 'Shop', path: '/shop' }];
    if (pCats.length > 0) {
      const primary = pCats[0];
      if (primary.parentId && catMap.has(primary.parentId)) {
        const parent = catMap.get(primary.parentId)!;
        breadcrumbs.push({ name: parent.name, path: `/categories/${parent.slug}` });
        breadcrumbs.push({
          name: primary.name,
          path: `/categories/${parent.slug}/${primary.slug}`,
        });
      } else {
        breadcrumbs.push({ name: primary.name, path: `/categories/${primary.slug}` });
      }
    }
    breadcrumbs.push({ name: p.name, path: `/products/${p.slug}` });

    res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=60');
    res.json({
      product: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: flags.showSku ? p.sku : '',
        shortDescription: p.shortDescription,
        fullDescription: p.fullDescription,
        mainImageUrl: p.mainImageUrl,
        galleryImages: p.galleryImages || [],
        imageAlt: p.imageAlt || p.name,
        productType: p.productType,
        isFeatured: p.isFeatured,
        isNew: p.isNew,
        tags: p.tags || [],
        specifications: p.specifications || [],
        regularPrice: flags.showPrices ? priceInfo.regularPrice : null,
        salePrice: flags.showPrices && flags.showSalePrices ? priceInfo.salePrice : null,
        unitPrice: flags.showPrices ? priceInfo.unitPrice : null,
        stockQuantity: flags.showStock ? p.stockQuantity : null,
        stockStatus: p.stockStatus,
        allowBackorder: p.allowBackorder,
        minOrderQty: p.minOrderQty,
        maxOrderQty: p.maxOrderQty,
        weight: p.weight,
        dimensions: p.dimensions,
        seoTitle: p.seoTitle || p.name,
        metaDescription: p.metaDescription || p.shortDescription,
        canonicalUrl: p.canonicalUrl || `/products/${p.slug}`,
        brand: brandRow,
        categories: pCats,
        flags,
      },
      attributes: productAttributes,
      variations: variations.map((v) => {
        const vPrice = getEffectivePrice(v.regularPrice, v.salePrice, v.saleStartDate, v.saleEndDate);
        return {
          id: v.id,
          sku: flags.showSku ? v.sku : '',
          regularPrice: flags.showPrices ? vPrice.regularPrice : null,
          salePrice: flags.showPrices && flags.showSalePrices ? vPrice.salePrice : null,
          unitPrice: flags.showPrices ? vPrice.unitPrice : null,
          stockQuantity: flags.showStock ? v.stockQuantity : null,
          stockStatus: v.stockStatus,
          backorderStatus: v.backorderStatus,
          imageUrl: v.imageUrl || p.mainImageUrl,
          galleryImages: v.galleryImages || [],
          weight: v.weight,
          dimensions: v.dimensions,
          attributes: v.attributes || [],
        };
      }),
      relatedProducts,
      breadcrumbs,
    });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ error: 'Failed to load product.' });
  }
});

// Category page lookup
router.get('/categories/:slug', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { slug } = req.params;
    const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found.' });
    const cat = rows[0];
    const children = await db
      .select()
      .from(categories)
      .where(and(eq(categories.parentId, cat.id), eq(categories.status, 'active')))
      .orderBy(asc(categories.sortOrder));
    const parent = cat.parentId
      ? (await db.select().from(categories).where(eq(categories.id, cat.parentId)).limit(1))[0] || null
      : null;
    res.json({ category: cat, parent, subcategories: children });
  } catch (error) {
    console.error('Category detail error:', error);
    res.status(500).json({ error: 'Failed to load category.' });
  }
});

// Brand page lookup
router.get('/brands/:slug', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const rows = await db.select().from(brands).where(eq(brands.slug, req.params.slug)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: 'Brand not found.' });
    res.json({ brand: rows[0] });
  } catch (error) {
    console.error('Brand detail error:', error);
    res.status(500).json({ error: 'Failed to load brand.' });
  }
});

// Static / CMS Website Page
router.get('/pages/:slug', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(websitePages)
      .where(and(eq(websitePages.slug, req.params.slug), eq(websitePages.isPublished, true)))
      .limit(1);
    if (rows.length === 0) return res.status(404).json({ error: 'Page not found.' });
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
    res.json({ page: rows[0] });
  } catch (error) {
    console.error('Page fetch error:', error);
    res.status(500).json({ error: 'Failed to load page.' });
  }
});

// Cart / Inquiry Cart CRUD
router.get('/cart', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const sessionId = getSessionId(req, res);
    const allSettings = await getAllSettings();
    const cart = await getOrCreateCart(sessionId);
    const hydrated = await hydrateCart(cart.id, allSettings);
    res.json({
      id: cart.id,
      couponCode: cart.couponCode || '',
      shippingMethodId: cart.shippingMethodId || null,
      ...hydrated,
    });
  } catch (error) {
    console.error('Cart get error:', error);
    res.status(500).json({ error: 'Failed to fetch cart.' });
  }
});

router.post('/cart/items', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const sessionId = getSessionId(req, res);
    const allSettings = await getAllSettings();
    const { productId, variationId = null, quantity = 1, selectedAttributes = [] } = req.body;

    const qty = Math.max(1, Number(quantity) || 1);
    const prodRows = await db.select().from(products).where(eq(products.id, Number(productId))).limit(1);
    if (prodRows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const prod = prodRows[0];

    if (prod.productType === 'variable' && !variationId) {
      return res.status(400).json({ error: 'Please select product options before adding.' });
    }

    if (allSettings.commerce?.operatingMode === 'ecommerce') {
      if (variationId) {
        const vRows = await db
          .select()
          .from(productVariations)
          .where(eq(productVariations.id, Number(variationId)))
          .limit(1);
        if (vRows.length === 0 || !vRows[0].isEnabled) {
          return res.status(400).json({ error: 'Selected variation is unavailable.' });
        }
        if (vRows[0].stockQuantity < qty && vRows[0].backorderStatus === 'no') {
          return res.status(400).json({ error: 'Insufficient stock for selected variation.' });
        }
      } else if (prod.stockQuantity < qty && !prod.allowBackorder) {
        return res.status(400).json({ error: 'Insufficient stock for this product.' });
      }
    }

    const cart = await getOrCreateCart(sessionId);
    const existingItems = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));

    const match = existingItems.find(
      (i) => i.productId === prod.id && (i.variationId || null) === (variationId ? Number(variationId) : null)
    );

    if (match) {
      await db
        .update(cartItems)
        .set({ quantity: match.quantity + qty })
        .where(eq(cartItems.id, match.id));
    } else {
      await db.insert(cartItems).values({
        cartId: cart.id,
        productId: prod.id,
        variationId: variationId ? Number(variationId) : null,
        quantity: qty,
        selectedAttributes,
      });
    }

    const hydrated = await hydrateCart(cart.id, allSettings);
    res.json({
      id: cart.id,
      couponCode: cart.couponCode || '',
      shippingMethodId: cart.shippingMethodId || null,
      ...hydrated,
    });
  } catch (error) {
    console.error('Cart add error:', error);
    res.status(500).json({ error: 'Failed to update cart.' });
  }
});

router.patch('/cart/items/:id', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const sessionId = getSessionId(req, res);
    const allSettings = await getAllSettings();
    const cart = await getOrCreateCart(sessionId);
    const itemId = Number(req.params.id);
    const qty = Number(req.body.quantity);

    if (qty <= 0) {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
    } else {
      await db
        .update(cartItems)
        .set({ quantity: qty })
        .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
    }

    const hydrated = await hydrateCart(cart.id, allSettings);
    res.json({
      id: cart.id,
      couponCode: cart.couponCode || '',
      shippingMethodId: cart.shippingMethodId || null,
      ...hydrated,
    });
  } catch (error) {
    console.error('Cart patch error:', error);
    res.status(500).json({ error: 'Failed to update quantity.' });
  }
});

router.delete('/cart/items/:id', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const sessionId = getSessionId(req, res);
    const allSettings = await getAllSettings();
    const cart = await getOrCreateCart(sessionId);
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, Number(req.params.id)), eq(cartItems.cartId, cart.id)));
    const hydrated = await hydrateCart(cart.id, allSettings);
    res.json({
      id: cart.id,
      couponCode: cart.couponCode || '',
      shippingMethodId: cart.shippingMethodId || null,
      ...hydrated,
    });
  } catch (error) {
    console.error('Cart delete error:', error);
    res.status(500).json({ error: 'Failed to remove item.' });
  }
});

// Apply or validate coupon in eCommerce Mode
router.post('/cart/apply-coupon', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const sessionId = getSessionId(req, res);
    const allSettings = await getAllSettings();
    if (allSettings.commerce?.operatingMode === 'catalogue') {
      return res.status(400).json({ error: 'Coupons are not applicable in Product Catalogue Mode.' });
    }
    const { code = '', email = '' } = req.body;
    const cart = await getOrCreateCart(sessionId);
    if (!code.trim()) {
      await db.update(carts).set({ couponCode: '' }).where(eq(carts.id, cart.id));
      return res.json({ valid: true, discountAmount: 0, freeShipping: false, couponCode: '' });
    }
    const hydrated = await hydrateCart(cart.id, allSettings);
    const result = await validateAndCalculateCoupon(
      code,
      hydrated.subtotal,
      email,
      hydrated.items.map((i) => ({
        productId: i.productId,
        categoryIds: i.categoryIds,
        lineTotal: i.lineTotal || 0,
      }))
    );
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }
    await db.update(carts).set({ couponCode: result.coupon!.code }).where(eq(carts.id, cart.id));
    res.json({
      valid: true,
      couponCode: result.coupon!.code,
      discountAmount: result.discountAmount,
      freeShipping: result.freeShipping,
      description: result.coupon!.description,
    });
  } catch (error) {
    console.error('Coupon apply error:', error);
    res.status(500).json({ error: 'Failed to validate coupon.' });
  }
});

// Available Shipping Methods for address & subtotal
router.post('/shipping/available', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { country = '', region = '', city = '', postalCode = '', subtotal = 0 } = req.body;
    const [methods, zones] = await Promise.all([
      db
        .select()
        .from(shippingMethods)
        .where(eq(shippingMethods.isActive, true))
        .orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.id)),
      db.select().from(shippingZones).where(eq(shippingZones.isActive, true)),
    ]);

    const zoneMap = new Map(zones.map((z) => [z.id, z]));
    const availableCountries = extractConfiguredShippingCountries(methods, zones);

    const eligible = methods
      .filter((m) =>
        isShippingMethodEligible(
          m,
          country,
          region,
          postalCode,
          city,
          m.zoneId ? zoneMap.get(m.zoneId) : null
        )
      )
      .map((m) => {
        const linkedZone = m.zoneId ? zoneMap.get(m.zoneId) : null;
        const qualifiesFree =
          m.freeShippingThreshold !== null &&
          m.freeShippingThreshold !== undefined &&
          Number(subtotal) >= m.freeShippingThreshold;
        const effectiveCountries =
          m.countries && m.countries.length > 0 ? m.countries : linkedZone?.countries || [];
        const effectiveRegions =
          m.regions && m.regions.length > 0 ? m.regions : linkedZone?.regions || [];
        const effectivePostal =
          m.postalCodes && m.postalCodes.length > 0 ? m.postalCodes : linkedZone?.postalCodes || [];
        return {
          ...m,
          zoneName: linkedZone?.name || '',
          effectiveCountries,
          effectiveRegions,
          effectivePostalCodes: effectivePostal,
          effectivePrice: qualifiesFree ? 0 : roundMoney(m.price),
          qualifiesFree,
        };
      });

    res.json({ methods: eligible, availableCountries });
  } catch (error) {
    console.error('Shipping lookup error:', error);
    res.status(500).json({ error: 'Failed to calculate shipping methods.' });
  }
});

// Place Order (eCommerce Mode ONLY — Cash on Delivery)
router.post('/checkout', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const sessionId = getSessionId(req, res);
    const allSettings = await getAllSettings();
    if (allSettings.commerce?.operatingMode !== 'ecommerce') {
      return res.status(403).json({
        error: 'Checkout is disabled while the platform is in Product Catalogue Mode.',
      });
    }
    if (!allSettings.commerce?.codEnabled) {
      return res.status(400).json({ error: 'Cash on Delivery is currently disabled.' });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      companyName = '',
      shippingAddress,
      billingAddress,
      shippingMethodId,
      couponCode = '',
      customerNotes = '',
    } = req.body;

    if (!firstName || !lastName || !email || !shippingAddress?.address1 || !shippingAddress?.city || !shippingAddress?.country) {
      return res.status(400).json({ error: 'Please complete all required customer and shipping fields.' });
    }

    const cart = await getOrCreateCart(sessionId);
    const rawItems = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Your shopping cart is empty.' });
    }

    // Recalculate everything strictly server-side from live DB product/variation records
    const prodIds = [...new Set(rawItems.map((i) => i.productId))];
    const prodRows = await db.select().from(products).where(inArray(products.id, prodIds));
    const prodMap = new Map(prodRows.map((p) => [p.id, p]));
    const prodCatMap = await getProductCategoryIdsMap(prodIds);

    let subtotal = 0;
    const preparedItems: Array<{
      productId: number;
      variationId: number | null;
      productName: string;
      productImage: string;
      sku: string;
      variationLabel: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
      categoryIds: number[];
    }> = [];

    for (const ci of rawItems) {
      const prod = prodMap.get(ci.productId);
      if (!prod) continue;
      let variation: typeof productVariations.$inferSelect | undefined;
      if (ci.variationId) {
        const vRows = await db
          .select()
          .from(productVariations)
          .where(eq(productVariations.id, ci.variationId))
          .limit(1);
        variation = vRows[0];
        if (!variation || !variation.isEnabled) {
          return res.status(400).json({ error: `Variation for ${prod.name} is unavailable.` });
        }
        if (variation.stockQuantity < ci.quantity && variation.backorderStatus === 'no') {
          return res.status(400).json({ error: `Insufficient stock for ${prod.name} (${variation.sku}).` });
        }
      } else {
        if (prod.stockQuantity < ci.quantity && !prod.allowBackorder) {
          return res.status(400).json({ error: `Insufficient stock for ${prod.name}.` });
        }
      }

      const priceInfo = variation
        ? getEffectivePrice(variation.regularPrice, variation.salePrice, variation.saleStartDate, variation.saleEndDate)
        : getEffectivePrice(prod.regularPrice, prod.salePrice, prod.saleStartDate, prod.saleEndDate);

      const lineTotal = roundMoney(priceInfo.unitPrice * ci.quantity);
      subtotal += lineTotal;

      preparedItems.push({
        productId: prod.id,
        variationId: variation?.id || null,
        productName: prod.name,
        productImage: variation?.imageUrl || prod.mainImageUrl || '',
        sku: variation?.sku || prod.sku,
        variationLabel:
          variation?.attributes?.map((a) => `${a.attributeName}: ${a.value}`).join(' · ') || '',
        unitPrice: priceInfo.unitPrice,
        quantity: ci.quantity,
        lineTotal,
        categoryIds: prodCatMap.get(prod.id) || [],
      });
    }

    subtotal = roundMoney(subtotal);

    // Server-side coupon validation
    let discountAmount = 0;
    let freeShippingFromCoupon = false;
    let appliedCoupon: typeof coupons.$inferSelect | undefined;
    const activeCode = couponCode || cart.couponCode || '';
    if (activeCode) {
      const cRes = await validateAndCalculateCoupon(activeCode, subtotal, email, preparedItems);
      if (cRes.valid && cRes.coupon) {
        discountAmount = cRes.discountAmount;
        freeShippingFromCoupon = cRes.freeShipping;
        appliedCoupon = cRes.coupon;
      }
    }

    // Server-side shipping verification
    let shippingCost = 0;
    let shippingMethodName = 'Standard Shipping';
    let chosenShippingId: number | null = null;
    if (shippingMethodId) {
      const mRows = await db
        .select()
        .from(shippingMethods)
        .where(eq(shippingMethods.id, Number(shippingMethodId)))
        .limit(1);
      if (mRows.length > 0) {
        const m = mRows[0];
        const zoneRow = m.zoneId
          ? (
              await db
                .select()
                .from(shippingZones)
                .where(eq(shippingZones.id, m.zoneId))
                .limit(1)
            )[0] || null
          : null;
        if (
          isShippingMethodEligible(
            m,
            shippingAddress.country,
            shippingAddress.state,
            shippingAddress.postalCode,
            shippingAddress.city,
            zoneRow
          )
        ) {
          chosenShippingId = m.id;
          shippingMethodName = m.name;
          const qualifiesFree =
            freeShippingFromCoupon ||
            (m.freeShippingThreshold !== null &&
              m.freeShippingThreshold !== undefined &&
              subtotal >= m.freeShippingThreshold);
          shippingCost = qualifiesFree ? 0 : roundMoney(m.price);
        }
      }
    }

    const taxRate = Number(allSettings.commerce?.taxRate || 0);
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const taxAmount = roundMoney((taxableBase * taxRate) / 100);
    const totalAmount = roundMoney(taxableBase + taxAmount + shippingCost);

    const cust = await upsertCustomerFromCheckout({
      firstName,
      lastName,
      email,
      phone,
      companyName,
      billingAddress: (billingAddress || shippingAddress).address1,
      shippingAddress: shippingAddress.address1,
      city: shippingAddress.city,
      stateRegion: shippingAddress.state,
      postalCode: shippingAddress.postalCode,
      country: shippingAddress.country,
      userId: req.dbUser?.id || null,
    });

    const orderNumber = generateUniqueRef('KA');
    const [createdOrder] = await db
      .insert(orders)
      .values({
        orderNumber,
        customerId: cust.id,
        customerEmail: email.trim().toLowerCase(),
        customerName: `${firstName} ${lastName}`.trim(),
        customerPhone: phone || '',
        companyName,
        billingAddress: billingAddress || shippingAddress,
        shippingAddress,
        shippingMethodId: chosenShippingId,
        shippingMethodName,
        shippingCost,
        subtotal,
        couponCode: appliedCoupon?.code || '',
        discountAmount,
        taxAmount,
        totalAmount,
        paymentMethod: 'cod',
        paymentStatus: 'unpaid',
        orderStatus: 'pending',
        customerNotes,
      })
      .returning();

    for (const item of preparedItems) {
      await db.insert(orderItems).values({
        orderId: createdOrder.id,
        productId: item.productId,
        variationId: item.variationId,
        productName: item.productName,
        productImage: item.productImage,
        sku: item.sku,
        variationLabel: item.variationLabel,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        snapshot: { orderedAt: new Date().toISOString() },
      });

      await adjustStockAndLog({
        productId: item.productId,
        variationId: item.variationId,
        sku: item.sku,
        delta: -item.quantity,
        reason: `Customer Order ${orderNumber}`,
        reference: orderNumber,
      });
    }

    await db.insert(orderHistory).values({
      orderId: createdOrder.id,
      orderStatus: 'pending',
      paymentStatus: 'unpaid',
      note: 'Order placed with Cash on Delivery.',
      changedBy: email,
    });

    if (appliedCoupon) {
      await db.insert(couponUsage).values({
        couponId: appliedCoupon.id,
        orderId: createdOrder.id,
        customerEmail: email.trim().toLowerCase(),
        discountApplied: discountAmount,
      });
      await db
        .update(coupons)
        .set({ usageCount: appliedCoupon.usageCount + 1 })
        .where(eq(coupons.id, appliedCoupon.id));
    }

    // Clear cart
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    await db.update(carts).set({ couponCode: '', shippingMethodId: null }).where(eq(carts.id, cart.id));

    await dispatchNotification(
      'order.created',
      createdOrder.customerEmail,
      {
        customerName: createdOrder.customerName,
        orderNumber: createdOrder.orderNumber,
        totalAmount: `$${createdOrder.totalAmount.toFixed(2)}`,
      },
      'order',
      createdOrder.id
    );

    const adminEmail = allSettings.email?.adminNotificationEmail || 'studio@kansoatelier.com';
    await dispatchNotification(
      'order.admin_alert',
      adminEmail,
      {
        customerName: createdOrder.customerName,
        email: createdOrder.customerEmail,
        orderNumber: createdOrder.orderNumber,
        totalAmount: `$${createdOrder.totalAmount.toFixed(2)}`,
      },
      'order',
      createdOrder.id
    );

    res.status(201).json({ order: createdOrder, items: preparedItems });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Order placement failed. Please verify your details.' });
  }
});

// Submit Inquiry (Catalogue Mode / Inquiry Cart)
router.post('/inquiries', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const sessionId = getSessionId(req, res);
    const allSettings = await getAllSettings();
    const {
      customerName,
      companyName = '',
      email,
      phone = '',
      message = '',
      preferredShippingMethod = '',
      items: directItems,
    } = req.body;

    if (!customerName || !email) {
      return res.status(400).json({ error: 'Customer name and email address are required.' });
    }

    const cart = await getOrCreateCart(sessionId);
    const hydrated = await hydrateCart(cart.id, allSettings);

    const sourceItems =
      Array.isArray(directItems) && directItems.length > 0 ? directItems : hydrated.items;

    if (sourceItems.length === 0) {
      return res.status(400).json({ error: 'Your inquiry cart is empty.' });
    }

    const nameParts = customerName.trim().split(' ');
    const cust = await upsertCustomerFromCheckout({
      firstName: nameParts[0] || customerName,
      lastName: nameParts.slice(1).join(' ') || '',
      email,
      phone,
      companyName,
      userId: req.dbUser?.id || null,
    });

    const inquiryRef = generateUniqueRef('INQ');
    const [created] = await db
      .insert(inquiries)
      .values({
        inquiryRef,
        customerId: cust.id,
        customerName: customerName.trim(),
        companyName,
        email: email.trim().toLowerCase(),
        phone,
        message,
        preferredShippingMethod,
        status: 'new',
      })
      .returning();

    const savedItems: Array<typeof inquiryItems.$inferSelect> = [];
    for (const item of sourceItems) {
      const [ii] = await db
        .insert(inquiryItems)
        .values({
          inquiryId: created.id,
          productId: item.productId || null,
          variationId: item.variationId || null,
          productName: item.productName,
          productImage: item.imageUrl || item.productImage || '',
          sku: item.sku || 'N/A',
          variationLabel: item.variationLabel || '',
          quantity: Math.max(1, Number(item.quantity) || 1),
          snapshot: { submittedAt: new Date().toISOString() },
        })
        .returning();
      savedItems.push(ii);
    }

    // Clear inquiry cart if used
    if (!Array.isArray(directItems) || directItems.length === 0) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    }

    await dispatchNotification(
      'inquiry.created',
      created.email,
      { customerName: created.customerName, inquiryRef: created.inquiryRef },
      'inquiry',
      created.id
    );
    const adminEmail = allSettings.email?.adminNotificationEmail || 'studio@kansoatelier.com';
    await dispatchNotification(
      'inquiry.admin_alert',
      adminEmail,
      {
        customerName: created.customerName,
        inquiryRef: created.inquiryRef,
        email: created.email,
      },
      'inquiry',
      created.id
    );

    res.status(201).json({
      inquiry: created,
      items: savedItems,
      confirmationMessage:
        allSettings.catalogue?.inquiryConfirmationMessage ||
        'Thank you. Your product inquiry has been submitted.',
    });
  } catch (error) {
    console.error('Inquiry submission error:', error);
    res.status(500).json({ error: 'Failed to submit inquiry.' });
  }
});

// Secure Customer Quotation View
router.get('/quotations/view/:ref', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { ref } = req.params;
    const token = String(req.query.token || '');
    const rows = await db.select().from(quotations).where(eq(quotations.quoteRef, ref)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: 'Quotation not found.' });
    const q = rows[0];
    if (q.secureToken !== token) {
      return res.status(403).json({ error: 'Invalid or missing quotation security token.' });
    }

    // Track viewed status & expiration
    let updatedQ = q;
    if (q.expiresAt && new Date() > new Date(q.expiresAt) && ['draft', 'sent', 'viewed'].includes(q.status)) {
      const [exp] = await db
        .update(quotations)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(quotations.id, q.id))
        .returning();
      updatedQ = exp;
    } else if (q.status === 'sent') {
      const [viewed] = await db
        .update(quotations)
        .set({ status: 'viewed', viewedAt: new Date(), updatedAt: new Date() })
        .where(eq(quotations.id, q.id))
        .returning();
      updatedQ = viewed;
    }

    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, q.id));
    const allSettings = await getAllSettings();

    res.json({
      quotation: updatedQ,
      items,
      company: allSettings.general,
    });
  } catch (error) {
    console.error('Quotation view error:', error);
    res.status(500).json({ error: 'Failed to load quotation.' });
  }
});

// Customer Accept / Reject Quotation
router.post('/quotations/respond/:ref', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { ref } = req.params;
    const { token, decision, comments = '' } = req.body;
    if (!['accepted', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be accepted or rejected.' });
    }
    const rows = await db.select().from(quotations).where(eq(quotations.quoteRef, ref)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: 'Quotation not found.' });
    const q = rows[0];
    if (q.secureToken !== token) {
      return res.status(403).json({ error: 'Invalid security token.' });
    }
    if (q.status === 'expired' || (q.expiresAt && new Date() > new Date(q.expiresAt))) {
      return res.status(400).json({ error: 'This quotation has expired.' });
    }

    const [updated] = await db
      .update(quotations)
      .set({
        status: decision,
        customerComments: comments,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, q.id))
      .returning();

    if (q.inquiryId) {
      await db
        .update(inquiries)
        .set({ status: 'responded', updatedAt: new Date() })
        .where(eq(inquiries.id, q.inquiryId));
    }

    const allSettings = await getAllSettings();
    const adminEmail = allSettings.email?.adminNotificationEmail || 'studio@kansoatelier.com';
    await dispatchNotification(
      'quotation.responded',
      adminEmail,
      {
        quoteRef: updated.quoteRef,
        status: decision,
        customerName: updated.customerName,
      },
      'quotation',
      updated.id
    );

    res.json({ quotation: updated });
  } catch (error) {
    console.error('Quotation respond error:', error);
    res.status(500).json({ error: 'Failed to record response.' });
  }
});

// Authenticated User Context & Customer Portal History
router.get('/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  res.json({
    user: req.dbUser,
    role: req.role,
    permissions: req.permissions || [],
  });
});

router.get('/customer/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const email = req.dbUser!.email.trim().toLowerCase();
    let custRows = await db
      .select()
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    if (custRows.length === 0) {
      const nameParts = (req.dbUser!.displayName || email.split('@')[0] || 'Customer')
        .trim()
        .split(/\s+/);
      const [created] = await db
        .insert(customers)
        .values({
          userId: req.dbUser!.id,
          firstName: nameParts[0] || 'Customer',
          lastName: nameParts.slice(1).join(' ') || '',
          email,
        })
        .returning();
      if (created) custRows = [created];
    }

    const [allOrders, allInquiries, allQuotations] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(inquiries).orderBy(desc(inquiries.createdAt)),
      db.select().from(quotations).orderBy(desc(quotations.createdAt)),
    ]);

    const profileId = custRows[0]?.id;
    const customerOrders = allOrders.filter(
      (o) =>
        o.customerEmail.trim().toLowerCase() === email ||
        (profileId && o.customerId === profileId)
    );
    const orderIds = customerOrders.map((o) => o.id);
    const [oItems, oHist] =
      orderIds.length > 0
        ? await Promise.all([
            db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
            db
              .select()
              .from(orderHistory)
              .where(inArray(orderHistory.orderId, orderIds))
              .orderBy(desc(orderHistory.createdAt)),
          ])
        : [[], []];

    const enrichedOrders = customerOrders.map((o) => ({
      ...o,
      items: oItems.filter((it) => it.orderId === o.id),
      history: oHist.filter((h) => h.orderId === o.id),
    }));

    const customerInquiries = allInquiries.filter(
      (i) => i.email.trim().toLowerCase() === email || (profileId && i.customerId === profileId)
    );
    const inqIds = customerInquiries.map((i) => i.id);
    const iItems =
      inqIds.length > 0
        ? await db.select().from(inquiryItems).where(inArray(inquiryItems.inquiryId, inqIds))
        : [];
    const enrichedInquiries = customerInquiries.map((inq) => ({
      ...inq,
      items: iItems.filter((it) => it.inquiryId === inq.id),
    }));

    const customerQuotations = allQuotations.filter(
      (q) => q.email.trim().toLowerCase() === email || (profileId && q.customerId === profileId)
    );
    const qIds = customerQuotations.map((q) => q.id);
    const qItems =
      qIds.length > 0
        ? await db.select().from(quotationItems).where(inArray(quotationItems.quotationId, qIds))
        : [];
    const enrichedQuotations = customerQuotations.map((q) => ({
      ...q,
      items: qItems.filter((it) => it.quotationId === q.id),
    }));

    const validOrders = enrichedOrders.filter(
      (o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'refunded'
    );
    const totalSpent = roundMoney(validOrders.reduce((s, o) => s + (o.totalAmount || 0), 0));

    res.json({
      profile: custRows[0] || null,
      orders: enrichedOrders,
      inquiries: enrichedInquiries,
      quotations: enrichedQuotations,
      summary: {
        totalOrders: enrichedOrders.length,
        totalSpent,
        activeOrders: enrichedOrders.filter(
          (o) => !['completed', 'cancelled', 'refunded'].includes(o.orderStatus)
        ).length,
        openInquiries: enrichedInquiries.filter((i) => !['converted', 'closed'].includes(i.status)).length,
        openQuotations: enrichedQuotations.filter((q) => ['sent', 'viewed'].includes(q.status)).length,
      },
    });
  } catch (error) {
    console.error('Customer history error:', error);
    res.status(500).json({ error: 'Failed to load account history.' });
  }
});

router.patch('/customer/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const email = req.dbUser!.email.toLowerCase();
    const {
      firstName,
      lastName,
      phone,
      companyName,
      billingAddress,
      shippingAddress,
      city,
      stateRegion,
      postalCode,
      country,
    } = req.body;
    const cust = await upsertCustomerFromCheckout({
      firstName: firstName || 'Customer',
      lastName: lastName || '',
      email,
      phone,
      companyName,
      billingAddress,
      shippingAddress,
      city,
      stateRegion,
      postalCode,
      country,
      userId: req.dbUser!.id,
    });
    res.json({ profile: cust });
  } catch (error) {
    console.error('Customer profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
