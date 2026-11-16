import { db } from './index.ts';
import {
  roles,
  permissions,
  categories,
  brands,
  attributes,
  attributeValues,
  products,
  productCategories,
  productVariations,
  variationAttributeValues,
  mediaLibrary,
  coupons,
  shippingZones,
  shippingMethods,
  settings,
  websitePages,
  emailTemplates,
  customers,
  orders,
  orderItems,
  orderHistory,
  inquiries,
  inquiryItems,
  quotations,
  quotationItems,
  urlRedirects,
} from './schema.ts';
import { count, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { DEFAULT_EMAIL_SETTINGS, DEFAULT_EMAIL_TEMPLATES } from '../services/platform.ts';

const ADMIN_MODULES = [
  'dashboard',
  'products',
  'categories',
  'brands',
  'attributes',
  'variations',
  'inventory',
  'orders',
  'inquiries',
  'quotations',
  'customers',
  'coupons',
  'shipping',
  'import_export',
  'media',
  'seo',
  'pages',
  'email_templates',
  'users',
  'settings',
];

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeedIfNeeded().catch((err) => {
      console.error('Seed check error:', err);
      seedPromise = null;
    });
  }
  return seedPromise;
}

async function runSeedIfNeeded(): Promise<void> {
  const existingSettings = await db.select({ total: count() }).from(settings);
  if ((existingSettings[0]?.total ?? 0) > 0) {
    await ensureHomeOfficeFurnitureEnriched();
    return;
  }

  console.log('Initializing Kanso Atelier PostgreSQL database seed...');

  // 1. Roles & Permissions
  const roleDefs = [
    {
      name: 'Super Administrator',
      slug: 'super-administrator',
      description: 'Full unrestricted access across all modules and system settings.',
      isSystem: true,
    },
    {
      name: 'Administrator',
      slug: 'administrator',
      description: 'Full operational access to store, catalogue, orders, and inquiries.',
      isSystem: true,
    },
    {
      name: 'Manager',
      slug: 'manager',
      description: 'Day-to-day oversight of catalog, orders, inquiries, and customers.',
      isSystem: true,
    },
    {
      name: 'Product Manager',
      slug: 'product-manager',
      description: 'Manage products, categories, brands, attributes, variations, and inventory.',
      isSystem: true,
    },
    {
      name: 'Order Manager',
      slug: 'order-manager',
      description: 'Process orders, shipments, coupons, and customer payment statuses.',
      isSystem: true,
    },
    {
      name: 'Inquiry Manager',
      slug: 'inquiry-manager',
      description: 'Handle catalogue inquiries, build quotations, and convert accepted quotes.',
      isSystem: true,
    },
    {
      name: 'Customer',
      slug: 'customer',
      description: 'Standard registered storefront customer account.',
      isSystem: true,
    },
  ];

  const insertedRoles = await db.insert(roles).values(roleDefs).returning();
  const roleBySlug = new Map(insertedRoles.map((r) => [r.slug, r]));

  const permRows: Array<{
    roleId: number;
    module: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }> = [];

  for (const r of insertedRoles) {
    if (r.slug === 'customer') continue;
    for (const mod of ADMIN_MODULES) {
      let canView = true;
      let canCreate = true;
      let canEdit = true;
      let canDelete = true;

      if (r.slug === 'administrator') {
        canDelete = mod !== 'users' && mod !== 'settings';
      } else if (r.slug === 'manager') {
        if (mod === 'users' || mod === 'settings') {
          canView = false;
          canCreate = false;
          canEdit = false;
          canDelete = false;
        }
      } else if (r.slug === 'product-manager') {
        const allowed = ['dashboard', 'products', 'categories', 'brands', 'attributes', 'variations', 'inventory', 'import_export', 'media', 'seo'];
        canView = allowed.includes(mod);
        canCreate = allowed.includes(mod) && mod !== 'dashboard';
        canEdit = allowed.includes(mod) && mod !== 'dashboard';
        canDelete = allowed.includes(mod) && mod !== 'dashboard';
      } else if (r.slug === 'order-manager') {
        const allowed = ['dashboard', 'orders', 'customers', 'coupons', 'shipping', 'inventory'];
        canView = allowed.includes(mod);
        canCreate = ['orders', 'coupons', 'shipping'].includes(mod);
        canEdit = allowed.includes(mod) && mod !== 'dashboard';
        canDelete = ['coupons'].includes(mod);
      } else if (r.slug === 'inquiry-manager') {
        const allowed = ['dashboard', 'inquiries', 'quotations', 'customers', 'products'];
        canView = allowed.includes(mod);
        canCreate = ['quotations', 'inquiries'].includes(mod);
        canEdit = ['inquiries', 'quotations', 'customers'].includes(mod);
        canDelete = false;
      }

      permRows.push({
        roleId: r.id,
        module: mod,
        canView,
        canCreate,
        canEdit,
        canDelete,
      });
    }
  }
  await db.insert(permissions).values(permRows);

  // 2. Global Settings
  await db.insert(settings).values([
    {
      key: 'general',
      category: 'general',
      value: {
        siteName: 'Kanso Atelier',
        tagline: 'Architectural Lighting, Joinery & Studio Objects',
        logoUrl: '',
        faviconUrl: '',
        contactEmail: 'studio@kansoatelier.com',
        phone: '+1 (415) 890-4210',
        address: '480 Brannan St, Suite 210, San Francisco, CA 94107',
        defaultLanguage: 'en',
        currency: 'USD',
        currencySymbol: '$',
        timezone: 'America/Los_Angeles',
        socialLinks: {
          instagram: 'https://instagram.com/kansoatelier',
          pinterest: 'https://pinterest.com/kansoatelier',
          linkedin: 'https://linkedin.com/company/kansoatelier',
        },
        heroImageUrl: '/src/assets/images/hero_architectural_atelier_1794681042828.jpg',
        heroHeadline: 'Sculptural Objects for Quiet Architecture',
        heroSubheadline:
          'Precision-milled lighting, solid white oak joinery, and studio vessels engineered for residential and hospitality spaces.',
      },
    },
    {
      key: 'commerce',
      category: 'commerce',
      value: {
        operatingMode: 'ecommerce', // 'ecommerce' | 'catalogue'
        showPrices: true,
        showSalePrices: true,
        showStock: true,
        showSkus: true,
        guestCheckoutEnabled: true,
        codEnabled: true,
        codInstructions: 'Pay in cash or certified check upon courier delivery.',
        taxRate: 8.5,
        taxLabel: 'Sales Tax (8.5%)',
        manageInventory: true,
        lowStockThreshold: 5,
      },
    },
    {
      key: 'catalogue',
      category: 'catalogue',
      value: {
        inquiryCartEnabled: true,
        enableInquiries: true,
        enableQuantitySelection: true,
        enableQuotations: true,
        showPricesInCatalogue: true,
        showStockInCatalogue: true,
        showSkusInCatalogue: true,
        collectShippingPreference: true,
        inquiryConfirmationMessage:
          'Thank you. Our architectural trade desk has received your specification inquiry and will prepare a formal quotation within 1 business day.',
        requiredFields: ['name', 'email', 'phone'],
      },
    },
    {
      key: 'email',
      category: 'email',
      value: DEFAULT_EMAIL_SETTINGS,
    },
    {
      key: 'seo',
      category: 'seo',
      value: {
        defaultMetaTitle: 'Kanso Atelier – Architectural Lighting & Studio Objects',
        defaultMetaDescription:
          'Explore Kanso Atelier architectural lighting, solid oak seating, and stoneware objects. Order online with Cash on Delivery or request a formal project quotation.',
        enableSitemap: true,
        robotsPolicy: 'index, follow',
        canonicalBaseUrl: process.env.APP_URL || '',
        ogDefaultImage: '/src/assets/images/hero_architectural_atelier_1794681042828.jpg',
      },
    },
  ]);

  // 3. Media Library
  await db.insert(mediaLibrary).values([
    {
      filename: 'hero_architectural_atelier.jpg',
      url: '/src/assets/images/hero_architectural_atelier_1794681042828.jpg',
      thumbnailUrl: '/src/assets/images/hero_architectural_atelier_1794681042828.jpg',
      altText: 'Kanso Atelier showroom featuring brushed brass pendant over white oak table',
      mimeType: 'image/jpeg',
      sizeBytes: 412000,
      width: 1600,
      height: 900,
      folder: 'banners',
    },
    {
      filename: 'product_monolith_lamp.jpg',
      url: '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
      thumbnailUrl: '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
      altText: 'Monolith matte black anodized aluminum articulated task lamp on travertine',
      mimeType: 'image/jpeg',
      sizeBytes: 285000,
      width: 1200,
      height: 900,
      folder: 'products',
    },
    {
      filename: 'product_oak_stool.jpg',
      url: '/src/assets/images/product_oak_stool_1794681042997.jpg',
      thumbnailUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
      altText: 'Aethel solid white oak low joinery stool in studio lighting',
      mimeType: 'image/jpeg',
      sizeBytes: 248000,
      width: 1200,
      height: 900,
      folder: 'products',
    },
    {
      filename: 'product_brass_pendant.jpg',
      url: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
      thumbnailUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
      altText: 'Faceted spun brushed brass geometric dome pendant light',
      mimeType: 'image/jpeg',
      sizeBytes: 262000,
      width: 1200,
      height: 900,
      folder: 'products',
    },
    {
      filename: 'product_ceramic_carafe.jpg',
      url: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
      thumbnailUrl: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
      altText: 'Matte stoneware carafe and travertine modular architectural desk tray',
      mimeType: 'image/jpeg',
      sizeBytes: 294000,
      width: 1200,
      height: 900,
      folder: 'products',
    },
  ]);

  // 4. Hierarchical Categories
  const [catLighting, catSeating, catObjects] = await db
    .insert(categories)
    .values([
      {
        name: 'Architectural Lighting',
        slug: 'lighting',
        description: 'Task lamps, spun metal pendants, and directional luminaires.',
        imageUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
        icon: 'Lamp',
        seoTitle: 'Architectural Lighting | Kanso Atelier',
        seoDescription: 'Precision-engineered brass pendants and anodized aluminum task lamps.',
        sortOrder: 1,
      },
      {
        name: 'Seating & Joinery',
        slug: 'seating-joinery',
        description: 'Solid white oak stools, benches, and architectural timber forms.',
        imageUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
        icon: 'Armchair',
        seoTitle: 'Seating & Joinery | Kanso Atelier',
        seoDescription: 'Hand-finished solid white oak stools and minimalist seating.',
        sortOrder: 2,
      },
      {
        name: 'Studio Objects',
        slug: 'studio-objects',
        description: 'Stoneware vessels, travertine deskware, and tactile accessories.',
        imageUrl: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
        icon: 'Layers',
        seoTitle: 'Studio Objects & Vessels | Kanso Atelier',
        seoDescription: 'Raw travertine trays and stoneware carafes for modern workspaces.',
        sortOrder: 3,
      },
    ])
    .returning();

  const [catTaskLamps, catPendants, catStools, catVessels] = await db
    .insert(categories)
    .values([
      {
        parentId: catLighting.id,
        name: 'Task Lamps',
        slug: 'task-lamps',
        description: 'Articulated studio desk and reading lamps.',
        imageUrl: '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
        sortOrder: 1,
      },
      {
        parentId: catLighting.id,
        name: 'Pendant Lights',
        slug: 'pendant-lights',
        description: 'Suspended spun-brass and architectural ceiling fixtures.',
        imageUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
        sortOrder: 2,
      },
      {
        parentId: catSeating.id,
        name: 'Stools & Benches',
        slug: 'stools-benches',
        description: 'Low-profile timber stools with exposed mortise joinery.',
        imageUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
        sortOrder: 1,
      },
      {
        parentId: catObjects.id,
        name: 'Vessels & Deskware',
        slug: 'vessels-deskware',
        description: 'Carafes, trays, and architectural table objects.',
        imageUrl: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
        sortOrder: 1,
      },
    ])
    .returning();

  // 5. Brands
  const [brandKanso, brandNordic, brandBrannan] = await db
    .insert(brands)
    .values([
      {
        name: 'Kanso Studio',
        slug: 'kanso-studio',
        description: 'In-house architectural lighting and precision aluminum studio hardware.',
        seoTitle: 'Kanso Studio Collection',
        seoDescription: 'Explore signature architectural objects designed by Kanso Studio.',
      },
      {
        name: 'Nordic Form',
        slug: 'nordic-form',
        description: 'Copenhagen timber workshop specializing in FSC-certified white oak joinery.',
        seoTitle: 'Nordic Form Timber Joinery',
        seoDescription: 'Solid oak stools and benches crafted in Copenhagen.',
      },
      {
        name: 'Atelier Brannan',
        slug: 'atelier-brannan',
        description: 'San Francisco stone and ceramic artisans producing tactile desk vessels.',
        seoTitle: 'Atelier Brannan Stone & Ceramics',
        seoDescription: 'Hand-carved travertine and stoneware objects by Atelier Brannan.',
      },
    ])
    .returning();

  // 6. Attributes & Values
  const [attrColor, attrSize, attrMaterial, attrCapacity] = await db
    .insert(attributes)
    .values([
      {
        name: 'Finish / Color',
        slug: 'color',
        displayType: 'swatch',
        usedForVariations: true,
        usedForFiltering: true,
        sortOrder: 1,
      },
      {
        name: 'Size',
        slug: 'size',
        displayType: 'button',
        usedForVariations: true,
        usedForFiltering: true,
        sortOrder: 2,
      },
      {
        name: 'Material',
        slug: 'material',
        displayType: 'dropdown',
        usedForVariations: false,
        usedForFiltering: true,
        sortOrder: 3,
      },
      {
        name: 'Capacity',
        slug: 'capacity',
        displayType: 'button',
        usedForVariations: true,
        usedForFiltering: true,
        sortOrder: 4,
      },
    ])
    .returning();

  const [
    valBlack,
    valBrass,
    valOak,
    valTravertine,
    valTerracotta,
    valCompact,
    valStandard,
    valGrand,
    val500ml,
    val1L,
  ] = await db
    .insert(attributeValues)
    .values([
      { attributeId: attrColor.id, value: 'Matte Black', slug: 'matte-black', colorHex: '#18181B', sortOrder: 1 },
      { attributeId: attrColor.id, value: 'Brushed Brass', slug: 'brushed-brass', colorHex: '#C5A059', sortOrder: 2 },
      { attributeId: attrColor.id, value: 'Natural Oak', slug: 'natural-oak', colorHex: '#C8A575', sortOrder: 3 },
      { attributeId: attrColor.id, value: 'Raw Travertine', slug: 'raw-travertine', colorHex: '#D8CFC2', sortOrder: 4 },
      { attributeId: attrColor.id, value: 'Terracotta', slug: 'terracotta', colorHex: '#B85D43', sortOrder: 5 },
      { attributeId: attrSize.id, value: 'Compact', slug: 'compact', sortOrder: 1 },
      { attributeId: attrSize.id, value: 'Standard', slug: 'standard', sortOrder: 2 },
      { attributeId: attrSize.id, value: 'Grand', slug: 'grand', sortOrder: 3 },
      { attributeId: attrCapacity.id, value: '500ml', slug: '500ml', sortOrder: 1 },
      { attributeId: attrCapacity.id, value: '1L', slug: '1l', sortOrder: 2 },
    ])
    .returning();

  // 7. Products & Multi-Attribute Variations
  const [prodLamp, prodStool, prodPendant, prodCarafe, prodTray, prodSconce] = await db
    .insert(products)
    .values([
      {
        name: 'Monolith Articulated Task Lamp',
        sku: 'KA-LMP-01',
        slug: 'monolith-articulated-task-lamp',
        shortDescription:
          'CNC-milled anodized aluminum cantilever task lamp with warm 2700K dimmable optics.',
        fullDescription:
          'Engineered with tension-balanced dual arms and a weighted solid base, the Monolith Articulated Task Lamp delivers glare-free illumination across drafting tables and executive desks. Each joint is machined to 0.05mm tolerance for effortless single-hand positioning.',
        mainImageUrl: '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
        galleryImages: [
          '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
          '/src/assets/images/hero_architectural_atelier_1794681042828.jpg',
        ],
        imageAlt: 'Monolith Articulated Task Lamp on travertine surface',
        brandId: brandKanso.id,
        tags: ['lighting', 'task-lamp', 'bestseller', 'architectural'],
        status: 'published',
        isFeatured: true,
        isNew: true,
        productType: 'variable',
        regularPrice: 420,
        salePrice: 380,
        costPrice: 175,
        stockQuantity: 28,
        stockStatus: 'in_stock',
        weight: 3.4,
        dimensions: { length: 42, width: 18, height: 54, unit: 'cm' },
        specifications: [
          { label: 'Light Source', value: 'Integrated 12W LED, 2700K, CRI 95+' },
          { label: 'Body Material', value: '6061 Anodized Aluminum & Machined Brass' },
          { label: 'Dimming', value: 'Stepless capacitive touch base dimmer' },
          { label: 'Cord Length', value: '2.4m braided textile cable' },
        ],
        seoTitle: 'Monolith Articulated Task Lamp | Kanso Atelier',
        metaDescription:
          'CNC-milled anodized aluminum task lamp with CRI 95+ LED optics in Matte Black and Brushed Brass.',
        assignedAttributes: [
          { attributeId: attrColor.id, valueIds: [valBlack.id, valBrass.id], usedForVariations: true },
          { attributeId: attrSize.id, valueIds: [valCompact.id, valStandard.id], usedForVariations: true },
        ],
      },
      {
        name: 'Aethel Solid Oak Joinery Stool',
        sku: 'KA-STL-02',
        slug: 'aethel-solid-oak-joinery-stool',
        shortDescription:
          'Sculpted European white oak low stool with exposed bevel mortise-and-tenon joinery.',
        fullDescription:
          'Carved from kiln-dried European white oak and finished in matte natural hardwax oil, the Aethel Stool pairs a subtly dished seat profile with flared architectural legs. Suitable as gallery seating, bedside plinth, or hospitality accent.',
        mainImageUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
        galleryImages: ['/src/assets/images/product_oak_stool_1794681042997.jpg'],
        imageAlt: 'Aethel Solid Oak Joinery Stool',
        brandId: brandNordic.id,
        tags: ['seating', 'white-oak', 'joinery'],
        status: 'published',
        isFeatured: true,
        isNew: false,
        productType: 'variable',
        regularPrice: 540,
        costPrice: 240,
        stockQuantity: 16,
        stockStatus: 'in_stock',
        weight: 6.8,
        dimensions: { length: 44, width: 32, height: 45, unit: 'cm' },
        specifications: [
          { label: 'Timber', value: 'FSC-Certified European White Oak' },
          { label: 'Finish', value: 'Matte plant-based hardwax oil' },
          { label: 'Load Rating', value: '180 kg commercial contract rated' },
        ],
        seoTitle: 'Aethel Solid Oak Joinery Stool | Nordic Form',
        metaDescription: 'Handcrafted solid white oak architectural stool with bevel joinery.',
        assignedAttributes: [
          { attributeId: attrColor.id, valueIds: [valOak.id, valBlack.id], usedForVariations: true },
          { attributeId: attrSize.id, valueIds: [valStandard.id, valGrand.id], usedForVariations: true },
        ],
      },
      {
        name: 'Faceted Spun Brass Dome Pendant',
        sku: 'KA-PND-03',
        slug: 'faceted-spun-brass-dome-pendant',
        shortDescription:
          'Hand-faceted solid brass luminaire casting warm architectural ambient reflection.',
        fullDescription:
          'Formed over custom steel mandrels and hand-brushed for a living satin patina, the Faceted Dome Pendant serves as a sculptural focal point over conference tables, dining islands, and boutique hotel lobbies.',
        mainImageUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
        galleryImages: [
          '/src/assets/images/product_brass_pendant_1794681044518.jpg',
          '/src/assets/images/hero_architectural_atelier_1794681042828.jpg',
        ],
        imageAlt: 'Faceted Spun Brass Dome Pendant Light',
        brandId: brandKanso.id,
        tags: ['pendant', 'brass', 'hospitality', 'lighting'],
        status: 'published',
        isFeatured: true,
        isNew: true,
        productType: 'variable',
        regularPrice: 780,
        salePrice: 690,
        costPrice: 320,
        stockQuantity: 14,
        stockStatus: 'in_stock',
        weight: 4.5,
        dimensions: { length: 45, width: 45, height: 30, unit: 'cm' },
        specifications: [
          { label: 'Shade Material', value: '2mm Solid Spun Brass' },
          { label: 'Socket', value: 'E26 / E27 Porcelain (UL & CE Listed)' },
          { label: 'Drop Cord', value: 'Adjustable up to 3.0m' },
        ],
        seoTitle: 'Faceted Spun Brass Dome Pendant | Kanso Atelier',
        metaDescription: 'Hand-faceted brushed brass pendant light for dining and hospitality spaces.',
        assignedAttributes: [
          { attributeId: attrColor.id, valueIds: [valBrass.id, valBlack.id], usedForVariations: true },
          { attributeId: attrSize.id, valueIds: [valCompact.id, valStandard.id, valGrand.id], usedForVariations: true },
        ],
      },
      {
        name: 'Stoneware & Glass Carafe Vessel',
        sku: 'KA-VES-04',
        slug: 'stoneware-glass-carafe-vessel',
        shortDescription:
          'Wheel-thrown raw stoneware sleeve paired with mouth-blown borosilicate carafe.',
        fullDescription:
          'Designed by Atelier Brannan for boardrooms and quiet tables, this two-part vessel insulates chilled water inside a protective tactile ceramic jacket with a precision viewing window and natural cork stopper.',
        mainImageUrl: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
        galleryImages: ['/src/assets/images/product_ceramic_carafe_1794681044606.jpg'],
        imageAlt: 'Stoneware and Glass Carafe Vessel',
        brandId: brandBrannan.id,
        tags: ['stoneware', 'carafe', 'deskware'],
        status: 'published',
        isFeatured: false,
        isNew: true,
        productType: 'variable',
        regularPrice: 145,
        costPrice: 52,
        stockQuantity: 42,
        stockStatus: 'in_stock',
        weight: 1.1,
        dimensions: { length: 11, width: 11, height: 26, unit: 'cm' },
        specifications: [
          { label: 'Body', value: 'High-fired unglazed stoneware + borosilicate glass' },
          { label: 'Stopper', value: 'Portuguese natural cork' },
        ],
        seoTitle: 'Stoneware & Glass Carafe Vessel | Atelier Brannan',
        metaDescription: 'Architectural stoneware and borosilicate carafe in 500ml and 1L sizes.',
        assignedAttributes: [
          { attributeId: attrColor.id, valueIds: [valTravertine.id, valTerracotta.id], usedForVariations: true },
          { attributeId: attrCapacity.id, valueIds: [val500ml.id, val1L.id], usedForVariations: true },
        ],
      },
      {
        name: 'Brannan Modular Travertine Desk Set',
        sku: 'KA-TRY-05',
        slug: 'brannan-modular-travertine-desk-set',
        shortDescription:
          'Honed Italian Roman travertine pen block, document tray, and catchall dish.',
        fullDescription:
          'Cut from a single slab of unfilled Roman travertine so the natural porous veining aligns across every module. Ideal for executive desks, architectural studios, and boutique reception counters.',
        mainImageUrl: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
        galleryImages: ['/src/assets/images/product_ceramic_carafe_1794681044606.jpg'],
        imageAlt: 'Brannan Modular Travertine Desk Set',
        brandId: brandBrannan.id,
        tags: ['travertine', 'desk-organizer', 'stone'],
        status: 'published',
        isFeatured: true,
        isNew: false,
        productType: 'simple',
        regularPrice: 220,
        salePrice: 195,
        costPrice: 88,
        stockQuantity: 19,
        stockStatus: 'in_stock',
        weight: 3.9,
        dimensions: { length: 34, width: 22, height: 10, unit: 'cm' },
        specifications: [
          { label: 'Stone Origin', value: 'Tivoli, Italy (Unfilled Honed Travertine)' },
          { label: 'Included Pieces', value: 'Pen cube, A5 tray, catchall, card plinth' },
        ],
        seoTitle: 'Brannan Modular Travertine Desk Set | Kanso Atelier',
        metaDescription: 'Four-piece honed Roman travertine modular architectural desk organizer.',
      },
      {
        name: 'Cantilever Architectural Wall Sconce',
        sku: 'KA-SCN-06',
        slug: 'cantilever-architectural-wall-sconce',
        shortDescription:
          'Minimalist hardwired anodized aluminum wall luminaire for corridors and reading alcoves.',
        fullDescription:
          'Flush-mounted wall sconce featuring an articulated cylinder shade and concealed brass swivel joint. Rated for damp architectural environments.',
        mainImageUrl: '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
        galleryImages: ['/src/assets/images/product_monolith_lamp_1794681042729.jpg'],
        imageAlt: 'Cantilever Architectural Wall Sconce',
        brandId: brandKanso.id,
        tags: ['sconce', 'wall-light', 'minimalist'],
        status: 'published',
        isFeatured: false,
        isNew: true,
        productType: 'simple',
        regularPrice: 310,
        costPrice: 130,
        stockQuantity: 4, // Low stock to showcase low-stock alerts!
        stockStatus: 'in_stock',
        weight: 1.8,
        dimensions: { length: 24, width: 12, height: 18, unit: 'cm' },
        specifications: [
          { label: 'Mounting', value: 'Standard 4" junction box concealed plate' },
          { label: 'IP Rating', value: 'IP44 Damp Rated' },
        ],
        seoTitle: 'Cantilever Architectural Wall Sconce | Kanso Atelier',
        metaDescription: 'Hardwired anodized aluminum wall sconce with brass swivel.',
      },
    ])
    .returning();

  // Link related products
  await db
    .update(products)
    .set({
      relatedProductIds: [prodPendant.id, prodSconce.id, prodTray.id],
      crossSellProductIds: [prodTray.id, prodCarafe.id],
      upsellProductIds: [prodPendant.id],
    })
    .where(eq(products.id, prodLamp.id));

  // Product Categories mapping
  await db.insert(productCategories).values([
    { productId: prodLamp.id, categoryId: catLighting.id, isPrimary: false },
    { productId: prodLamp.id, categoryId: catTaskLamps.id, isPrimary: true },
    { productId: prodStool.id, categoryId: catSeating.id, isPrimary: false },
    { productId: prodStool.id, categoryId: catStools.id, isPrimary: true },
    { productId: prodPendant.id, categoryId: catLighting.id, isPrimary: false },
    { productId: prodPendant.id, categoryId: catPendants.id, isPrimary: true },
    { productId: prodCarafe.id, categoryId: catObjects.id, isPrimary: false },
    { productId: prodCarafe.id, categoryId: catVessels.id, isPrimary: true },
    { productId: prodTray.id, categoryId: catObjects.id, isPrimary: false },
    { productId: prodTray.id, categoryId: catVessels.id, isPrimary: true },
    { productId: prodSconce.id, categoryId: catLighting.id, isPrimary: true },
    { productId: prodSconce.id, categoryId: catTaskLamps.id, isPrimary: false },
  ]);

  // 8. Product Variations (Full WooCommerce-style combinations)
  const varDefs = [
    // Monolith Task Lamp variations
    {
      productId: prodLamp.id,
      sku: 'KA-LMP-01-BLK-CMP',
      regularPrice: 390,
      salePrice: 350,
      stockQuantity: 12,
      imageUrl: '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valBlack.id, value: 'Matte Black', colorHex: '#18181B' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valCompact.id, value: 'Compact' },
      ],
    },
    {
      productId: prodLamp.id,
      sku: 'KA-LMP-01-BLK-STD',
      regularPrice: 420,
      salePrice: 380,
      stockQuantity: 10,
      imageUrl: '/src/assets/images/product_monolith_lamp_1794681042729.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valBlack.id, value: 'Matte Black', colorHex: '#18181B' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valStandard.id, value: 'Standard' },
      ],
    },
    {
      productId: prodLamp.id,
      sku: 'KA-LMP-01-BRS-CMP',
      regularPrice: 440,
      salePrice: null,
      stockQuantity: 4,
      imageUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valBrass.id, value: 'Brushed Brass', colorHex: '#C5A059' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valCompact.id, value: 'Compact' },
      ],
    },
    {
      productId: prodLamp.id,
      sku: 'KA-LMP-01-BRS-STD',
      regularPrice: 475,
      salePrice: null,
      stockQuantity: 2,
      imageUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valBrass.id, value: 'Brushed Brass', colorHex: '#C5A059' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valStandard.id, value: 'Standard' },
      ],
    },
    // Aethel Stool variations
    {
      productId: prodStool.id,
      sku: 'KA-STL-02-OAK-STD',
      regularPrice: 540,
      salePrice: null,
      stockQuantity: 9,
      imageUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valOak.id, value: 'Natural Oak', colorHex: '#C8A575' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valStandard.id, value: 'Standard' },
      ],
    },
    {
      productId: prodStool.id,
      sku: 'KA-STL-02-OAK-GRD',
      regularPrice: 640,
      salePrice: null,
      stockQuantity: 4,
      imageUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valOak.id, value: 'Natural Oak', colorHex: '#C8A575' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valGrand.id, value: 'Grand' },
      ],
    },
    {
      productId: prodStool.id,
      sku: 'KA-STL-02-BLK-STD',
      regularPrice: 560,
      salePrice: null,
      stockQuantity: 3,
      imageUrl: '/src/assets/images/product_oak_stool_1794681042997.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valBlack.id, value: 'Matte Black', colorHex: '#18181B' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valStandard.id, value: 'Standard' },
      ],
    },
    // Faceted Brass Pendant variations
    {
      productId: prodPendant.id,
      sku: 'KA-PND-03-BRS-CMP',
      regularPrice: 680,
      salePrice: 620,
      stockQuantity: 6,
      imageUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valBrass.id, value: 'Brushed Brass', colorHex: '#C5A059' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valCompact.id, value: 'Compact' },
      ],
    },
    {
      productId: prodPendant.id,
      sku: 'KA-PND-03-BRS-STD',
      regularPrice: 780,
      salePrice: 690,
      stockQuantity: 5,
      imageUrl: '/src/assets/images/product_brass_pendant_1794681044518.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valBrass.id, value: 'Brushed Brass', colorHex: '#C5A059' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valStandard.id, value: 'Standard' },
      ],
    },
    {
      productId: prodPendant.id,
      sku: 'KA-PND-03-BRS-GRD',
      regularPrice: 960,
      salePrice: null,
      stockQuantity: 3,
      imageUrl: '/src/assets/images/hero_architectural_atelier_1794681042828.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valBrass.id, value: 'Brushed Brass', colorHex: '#C5A059' },
        { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: valGrand.id, value: 'Grand' },
      ],
    },
    // Carafe variations
    {
      productId: prodCarafe.id,
      sku: 'KA-VES-04-TRV-500',
      regularPrice: 125,
      salePrice: null,
      stockQuantity: 22,
      imageUrl: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valTravertine.id, value: 'Raw Travertine', colorHex: '#D8CFC2' },
        { attributeId: attrCapacity.id, attributeName: 'Capacity', attributeSlug: 'capacity', valueId: val500ml.id, value: '500ml' },
      ],
    },
    {
      productId: prodCarafe.id,
      sku: 'KA-VES-04-TRV-1L',
      regularPrice: 145,
      salePrice: null,
      stockQuantity: 14,
      imageUrl: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valTravertine.id, value: 'Raw Travertine', colorHex: '#D8CFC2' },
        { attributeId: attrCapacity.id, attributeName: 'Capacity', attributeSlug: 'capacity', valueId: val1L.id, value: '1L' },
      ],
    },
    {
      productId: prodCarafe.id,
      sku: 'KA-VES-04-TER-1L',
      regularPrice: 155,
      salePrice: null,
      stockQuantity: 6,
      imageUrl: '/src/assets/images/product_ceramic_carafe_1794681044606.jpg',
      attributes: [
        { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: valTerracotta.id, value: 'Terracotta', colorHex: '#B85D43' },
        { attributeId: attrCapacity.id, attributeName: 'Capacity', attributeSlug: 'capacity', valueId: val1L.id, value: '1L' },
      ],
    },
  ];

  const insertedVars = await db.insert(productVariations).values(varDefs).returning();
  const varAttrRows: Array<{ variationId: number; attributeId: number; attributeValueId: number }> = [];
  for (const v of insertedVars) {
    for (const a of v.attributes || []) {
      varAttrRows.push({
        variationId: v.id,
        attributeId: a.attributeId,
        attributeValueId: a.valueId,
      });
    }
  }
  await db.insert(variationAttributeValues).values(varAttrRows);

  // 9. Coupons
  await db.insert(coupons).values([
    {
      code: 'ATELIER15',
      description: '15% seasonal trade discount on orders over $150',
      discountType: 'percentage',
      discountValue: 15,
      minPurchaseAmount: 150,
      maxDiscountAmount: 250,
      maxUsage: 500,
      usageLimitPerCustomer: 3,
      isActive: true,
    },
    {
      code: 'WELCOME25',
      description: '$25 off first architectural object order',
      discountType: 'fixed',
      discountValue: 25,
      minPurchaseAmount: 100,
      maxUsage: 200,
      isActive: true,
    },
    {
      code: 'FREESHIP',
      description: 'Complimentary standard courier delivery',
      discountType: 'free_shipping',
      discountValue: 0,
      minPurchaseAmount: 0,
      isActive: true,
    },
  ]);

  // 10. Shipping Zones & Methods
  const [zoneUS, zoneEU] = await db
    .insert(shippingZones)
    .values([
      {
        name: 'United States & Canada',
        countries: ['US', 'CA', 'United States', 'Canada'],
        regions: [],
        postalCodes: [],
        isActive: true,
      },
      {
        name: 'European Union',
        countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'CY', 'GR', 'Germany', 'France', 'Cyprus'],
        regions: [],
        postalCodes: [],
        isActive: true,
      },
    ])
    .returning();

  await db.insert(shippingMethods).values([
    {
      zoneId: zoneUS.id,
      name: 'Standard Insured Courier',
      description: 'Tracked ground delivery with signature confirmation.',
      price: 18,
      freeShippingThreshold: 400,
      estimatedDeliveryTime: '3-5 business days',
      countries: ['US', 'CA', 'United States', 'Canada'],
      isActive: true,
      sortOrder: 1,
    },
    {
      zoneId: zoneUS.id,
      name: 'Express Priority Air',
      description: 'Expedited two-day air freight with white-glove packaging.',
      price: 38,
      estimatedDeliveryTime: '1-2 business days',
      countries: ['US', 'CA', 'United States', 'Canada'],
      isActive: true,
      sortOrder: 2,
    },
    {
      zoneId: zoneUS.id,
      name: 'San Francisco Studio Pickup',
      description: 'Collect directly from our 480 Brannan St showroom.',
      price: 0,
      estimatedDeliveryTime: 'Ready within 24 hours',
      countries: ['US', 'United States'],
      isActive: true,
      sortOrder: 3,
    },
    {
      zoneId: zoneEU.id,
      name: 'International DHL Freight',
      description: 'Customs-cleared air courier across EU member states.',
      price: 45,
      freeShippingThreshold: 900,
      estimatedDeliveryTime: '4-7 business days',
      countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'CY', 'GR', 'Germany', 'France', 'Cyprus'],
      isActive: true,
      sortOrder: 4,
    },
  ]);

  // 11. Customers, Sample Order, Sample Inquiry & Sample Quotation
  const [sampleCustomer] = await db
    .insert(customers)
    .values({
      firstName: 'Elena',
      lastName: 'Vance',
      email: 'elena.vance@nordicarch.co',
      phone: '+1 (415) 555-0192',
      companyName: 'Vance & Partners Architecture',
      billingAddress: '720 Market St, Floor 8',
      shippingAddress: '720 Market St, Floor 8',
      city: 'San Francisco',
      stateRegion: 'CA',
      postalCode: '94102',
      country: 'United States',
      notes: 'Hospitality & residential trade partner.',
    })
    .returning();

  const [sampleOrder] = await db
    .insert(orders)
    .values({
      orderNumber: 'KA-2026-1001',
      customerId: sampleCustomer.id,
      customerEmail: sampleCustomer.email,
      customerName: 'Elena Vance',
      customerPhone: sampleCustomer.phone || '',
      companyName: sampleCustomer.companyName || '',
      billingAddress: {
        firstName: 'Elena',
        lastName: 'Vance',
        company: 'Vance & Partners Architecture',
        address1: '720 Market St, Floor 8',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94102',
        country: 'United States',
      },
      shippingAddress: {
        firstName: 'Elena',
        lastName: 'Vance',
        company: 'Vance & Partners Architecture',
        address1: '720 Market St, Floor 8',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94102',
        country: 'United States',
      },
      shippingMethodName: 'Standard Insured Courier',
      shippingCost: 0,
      subtotal: 920,
      discountAmount: 0,
      taxAmount: 78.2,
      totalAmount: 998.2,
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
      orderStatus: 'processing',
      customerNotes: 'Please call reception upon arrival.',
    })
    .returning();

  await db.insert(orderItems).values([
    {
      orderId: sampleOrder.id,
      productId: prodLamp.id,
      variationId: insertedVars[1].id,
      productName: prodLamp.name,
      productImage: prodLamp.mainImageUrl || '',
      sku: insertedVars[1].sku,
      variationLabel: 'Matte Black · Standard',
      unitPrice: 380,
      quantity: 1,
      lineTotal: 380,
    },
    {
      orderId: sampleOrder.id,
      productId: prodStool.id,
      variationId: insertedVars[4].id,
      productName: prodStool.name,
      productImage: prodStool.mainImageUrl || '',
      sku: insertedVars[4].sku,
      variationLabel: 'Natural Oak · Standard',
      unitPrice: 540,
      quantity: 1,
      lineTotal: 540,
    },
  ]);

  await db.insert(orderHistory).values({
    orderId: sampleOrder.id,
    orderStatus: 'processing',
    paymentStatus: 'unpaid',
    note: 'Order placed via Cash on Delivery and confirmed for dispatch.',
    changedBy: 'system',
  });

  const [sampleInquiry] = await db
    .insert(inquiries)
    .values({
      inquiryRef: 'INQ-2026-401',
      customerId: sampleCustomer.id,
      customerName: 'Elena Vance',
      companyName: 'Vance & Partners Architecture',
      email: sampleCustomer.email,
      phone: sampleCustomer.phone || '',
      message:
        'Requesting formal trade quotation for 8 Brass Dome Pendants and 12 Oak Stools for our Marin boutique hotel lobby.',
      preferredShippingMethod: 'Standard Insured Courier',
      status: 'quoted',
    })
    .returning();

  await db.insert(inquiryItems).values([
    {
      inquiryId: sampleInquiry.id,
      productId: prodPendant.id,
      variationId: insertedVars[8].id,
      productName: prodPendant.name,
      productImage: prodPendant.mainImageUrl || '',
      sku: insertedVars[8].sku,
      variationLabel: 'Brushed Brass · Standard',
      quantity: 8,
    },
    {
      inquiryId: sampleInquiry.id,
      productId: prodStool.id,
      variationId: insertedVars[4].id,
      productName: prodStool.name,
      productImage: prodStool.mainImageUrl || '',
      sku: insertedVars[4].sku,
      variationLabel: 'Natural Oak · Standard',
      quantity: 12,
    },
  ]);

  const quoteToken = crypto.randomBytes(16).toString('hex');
  const [sampleQuote] = await db
    .insert(quotations)
    .values({
      quoteRef: 'QT-2026-801',
      secureToken: quoteToken,
      inquiryId: sampleInquiry.id,
      customerId: sampleCustomer.id,
      customerName: 'Elena Vance',
      companyName: 'Vance & Partners Architecture',
      email: sampleCustomer.email,
      phone: sampleCustomer.phone || '',
      status: 'sent',
      discountType: 'percentage',
      discountValue: 10,
      shippingCost: 120,
      taxRate: 8.5,
      subtotal: 12000,
      totalDiscount: 1200,
      taxAmount: 918,
      additionalFees: 0,
      grandTotal: 11838,
      notes: 'Includes 10% architectural trade volume allowance. Delivery scheduled within 3 weeks.',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      sentAt: new Date(),
    })
    .returning();

  await db.insert(quotationItems).values([
    {
      quotationId: sampleQuote.id,
      productId: prodPendant.id,
      variationId: insertedVars[8].id,
      productName: prodPendant.name,
      productImage: prodPendant.mainImageUrl || '',
      sku: insertedVars[8].sku,
      variationLabel: 'Brushed Brass · Standard',
      quantity: 8,
      unitPrice: 690,
      lineDiscount: 0,
      lineTotal: 5520,
    },
    {
      quotationId: sampleQuote.id,
      productId: prodStool.id,
      variationId: insertedVars[4].id,
      productName: prodStool.name,
      productImage: prodStool.mainImageUrl || '',
      sku: insertedVars[4].sku,
      variationLabel: 'Natural Oak · Standard',
      quantity: 12,
      unitPrice: 540,
      lineDiscount: 0,
      lineTotal: 6480,
    },
  ]);

  // 12. Website Pages
  await db.insert(websitePages).values([
    {
      title: 'About Us',
      slug: 'about-us',
      content:
        'Founded in San Francisco, Kanso Atelier designs and curates architectural lighting, solid timber joinery, and mineral deskware built to outlast seasonal trends. Every object is available for both direct studio purchase and bespoke architectural project quotation.',
      seoTitle: 'About Kanso Atelier – Craftsmanship & Materials',
      metaDescription: 'Learn about Kanso Atelier architectural lighting and timber joinery.',
      sortOrder: 1,
    },
    {
      title: 'Contact Us',
      slug: 'contact-us',
      content:
        'Visit our showroom at 480 Brannan St, Suite 210, San Francisco, CA 94107, or reach our trade and retail desk at studio@kansoatelier.com · +1 (415) 890-4210. Open Monday–Saturday, 10:00–18:00 PST.',
      seoTitle: 'Contact Kanso Atelier Showroom & Trade Desk',
      metaDescription: 'Get in touch with Kanso Atelier for orders, inquiries, and architectural specs.',
      sortOrder: 2,
    },
    {
      title: 'FAQ',
      slug: 'faq',
      content:
        '1. How does Cash on Delivery work? Pay directly upon delivery by cash or certified check. 2. Can I request a custom trade quotation? Yes—switch to or browse in Product Catalogue Mode to add multiple SKUs to your inquiry cart and receive a formal PDF quotation. 3. Are replacement diffusers and parts stocked? Yes, we stock spare components for 10 years.',
      seoTitle: 'Frequently Asked Questions | Kanso Atelier',
      metaDescription: 'Answers about Cash on Delivery, trade quotations, shipping, and care.',
      sortOrder: 3,
    },
    {
      title: 'Shipping & Returns',
      slug: 'shipping-and-returns',
      content:
        'All lighting and furniture pieces are inspected, serial-tagged, and packed in custom recycled pulp crating. Standard insured courier orders ship within 48 business hours. Unused items in original packaging may be returned within 30 days.',
      seoTitle: 'Shipping & Returns Policy | Kanso Atelier',
      metaDescription: 'Detailed courier timelines, freight zones, and 30-day return policy.',
      sortOrder: 4,
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      content:
        'Kanso Atelier respects your privacy and collects only the contact, billing, and shipping details required to fulfill orders, process inquiries, and issue formal quotations.',
      seoTitle: 'Privacy Policy | Kanso Atelier',
      metaDescription: 'How Kanso Atelier protects customer and trade partner data.',
      sortOrder: 5,
    },
    {
      title: 'Terms & Conditions',
      slug: 'terms-and-conditions',
      content:
        'All orders placed in eCommerce Mode are fulfilled on a Cash on Delivery basis unless converted from an approved trade quotation. Quotations remain valid until their stated expiration date.',
      seoTitle: 'Terms & Conditions | Kanso Atelier',
      metaDescription: 'Terms of sale, quotation validity, and commercial warranty.',
      sortOrder: 6,
    },
  ]);

  // 13. Email Templates
  await db.insert(emailTemplates).values(DEFAULT_EMAIL_TEMPLATES);

  // 14. Sample URL Redirect
  await db.insert(urlRedirects).values([
    {
      sourcePath: '/shop/monolith-lamp',
      targetPath: '/products/monolith-articulated-task-lamp',
      statusCode: 301,
      isActive: true,
    },
  ]);

  console.log('Kanso Atelier seed completed.');
  await ensureHomeOfficeFurnitureEnriched();
}

async function ensureHomeOfficeFurnitureEnriched(): Promise<void> {
  const marker = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'catalog_home_office_v1'))
    .limit(1);
  if (marker.length > 0) return;

  console.log('Enriching Kanso Atelier catalog with Home & Office Furniture...');

  // 1. Update general, seo, and email settings toward Home & Office Furniture
  const genRow = await db.select().from(settings).where(eq(settings.key, 'general')).limit(1);
  if (genRow[0]) {
    const cur = (genRow[0].value as Record<string, any>) || {};
    await db
      .update(settings)
      .set({
        value: {
          ...cur,
          tagline: 'Architectural Home & Office Furniture',
          heroImageUrl: '/src/assets/images/hero_home_office_furniture_1794755051626.jpg',
          heroHeadline: 'Sculptural Furniture for Home & Modern Workspaces',
          heroSubheadline:
            'Solid European oak & walnut desks, tailored bouclé lounge seating, ergonomic task chairs, and architectural credenzas built for residential living and studio offices.',
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.key, 'general'));
  }

  const seoRow = await db.select().from(settings).where(eq(settings.key, 'seo')).limit(1);
  if (seoRow[0]) {
    const cur = (seoRow[0].value as Record<string, any>) || {};
    await db
      .update(settings)
      .set({
        value: {
          ...cur,
          defaultMetaTitle: 'Kanso Atelier – Home & Office Furniture',
          defaultMetaDescription:
            'Explore handcrafted home and office furniture: walnut executive desks, ergonomic task chairs, bouclé lounge seating, and solid oak credenzas.',
          ogDefaultImage: '/src/assets/images/hero_home_office_furniture_1794755051626.jpg',
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.key, 'seo'));
  }

  const emailRow = await db.select().from(settings).where(eq(settings.key, 'email')).limit(1);
  if (emailRow[0]) {
    const cur = (emailRow[0].value as Record<string, any>) || {};
    await db
      .update(settings)
      .set({
        value: {
          ...cur,
          headerTagline: 'Architectural Home & Office Furniture',
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.key, 'email'));
  }

  // 2. Media library additions
  const existingMedia = await db.select({ filename: mediaLibrary.filename }).from(mediaLibrary);
  const mediaNames = new Set(existingMedia.map((m) => m.filename));
  const newMedia = [
    {
      filename: 'hero_home_office_furniture.jpg',
      url: '/src/assets/images/hero_home_office_furniture_1794755051626.jpg',
      thumbnailUrl: '/src/assets/images/hero_home_office_furniture_1794755051626.jpg',
      altText: 'Sunlit architectural showroom pairing solid walnut executive desk, ergonomic chair, bouclé lounge chair, and slatted oak credenza',
      mimeType: 'image/jpeg',
      sizeBytes: 440000,
      width: 1600,
      height: 900,
      folder: 'banners',
    },
    {
      filename: 'furniture_lounge_sofa.jpg',
      url: '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
      thumbnailUrl: '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
      altText: 'Kyoto low-profile oatmeal bouclé and solid white oak lounge armchair',
      mimeType: 'image/jpeg',
      sizeBytes: 295000,
      width: 1200,
      height: 900,
      folder: 'products',
    },
    {
      filename: 'furniture_executive_desk.jpg',
      url: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
      thumbnailUrl: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
      altText: 'Atelier solid walnut and matte black steel executive home-office desk',
      mimeType: 'image/jpeg',
      sizeBytes: 278000,
      width: 1200,
      height: 900,
      folder: 'products',
    },
    {
      filename: 'furniture_office_chair.jpg',
      url: '/src/assets/images/furniture_office_chair_1794755052211.jpg',
      thumbnailUrl: '/src/assets/images/furniture_office_chair_1794755052211.jpg',
      altText: 'Aeronaut sculpted walnut shell and leather ergonomic office task chair',
      mimeType: 'image/jpeg',
      sizeBytes: 264000,
      width: 1200,
      height: 900,
      folder: 'products',
    },
    {
      filename: 'furniture_oak_credenza.jpg',
      url: '/src/assets/images/furniture_oak_credenza_1794755051893.jpg',
      thumbnailUrl: '/src/assets/images/furniture_oak_credenza_1794755051893.jpg',
      altText: 'Soren slatted solid white oak credenza sideboard with travertine top',
      mimeType: 'image/jpeg',
      sizeBytes: 288000,
      width: 1200,
      height: 900,
      folder: 'products',
    },
  ].filter((m) => !mediaNames.has(m.filename));
  if (newMedia.length > 0) {
    await db.insert(mediaLibrary).values(newMedia);
  }

  // 3. Reorder existing root categories so Home & Office Furniture lead cleanly
  const allCatsBefore = await db.select().from(categories);
  const catBySlug = new Map(allCatsBefore.map((c) => [c.slug, c]));

  const reorderSlugs: Array<[string, number]> = [
    ['lighting', 3],
    ['seating-joinery', 4],
    ['studio-objects', 5],
  ];
  for (const [slug, order] of reorderSlugs) {
    const existing = catBySlug.get(slug);
    if (existing) {
      await db.update(categories).set({ sortOrder: order }).where(eq(categories.id, existing.id));
    }
  }

  const upsertCategory = async (payload: {
    parentId?: number | null;
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    icon?: string;
    seoTitle: string;
    seoDescription: string;
    sortOrder: number;
  }) => {
    const existing = catBySlug.get(payload.slug);
    if (existing) return existing;
    const [inserted] = await db.insert(categories).values(payload).returning();
    catBySlug.set(inserted.slug, inserted);
    return inserted;
  };

  const catHome = await upsertCategory({
    name: 'Home Furniture',
    slug: 'home-furniture',
    description: 'Sculptural lounge seating, dining tables, and slatted oak sideboards for residential living.',
    imageUrl: '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
    icon: 'Sofa',
    seoTitle: 'Home Furniture | Kanso Atelier',
    seoDescription: 'Warm minimalist lounge armchairs, sofas, dining tables, and oak storage for residential spaces.',
    sortOrder: 1,
  });

  const catOffice = await upsertCategory({
    name: 'Office Furniture',
    slug: 'office-furniture',
    description: 'Solid timber executive desks, ergonomic leather task chairs, and architectural credenzas.',
    imageUrl: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
    icon: 'Briefcase',
    seoTitle: 'Office Furniture | Kanso Atelier',
    seoDescription: 'Ergonomic seating, solid walnut writing desks, and studio storage systems.',
    sortOrder: 2,
  });

  const catLivingSeating = await upsertCategory({
    parentId: catHome.id,
    name: 'Living Room Seating',
    slug: 'living-room-seating',
    description: 'Bouclé lounge armchairs, modular sofas, and reading chairs.',
    imageUrl: '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
    seoTitle: 'Living Room Seating | Kanso Atelier',
    seoDescription: 'Low-profile bouclé lounge chairs and solid timber sofas.',
    sortOrder: 1,
  });

  const catHomeStorage = await upsertCategory({
    parentId: catHome.id,
    name: 'Credenzas & Sideboards',
    slug: 'credenzas-home-storage',
    description: 'Slatted oak consoles, media cabinets, and travertine-topped sideboards.',
    imageUrl: '/src/assets/images/furniture_oak_credenza_1794755051893.jpg',
    seoTitle: 'Credenzas & Sideboards | Kanso Atelier',
    seoDescription: 'Architectural solid oak credenzas and living room storage.',
    sortOrder: 2,
  });

  const catExecDesks = await upsertCategory({
    parentId: catOffice.id,
    name: 'Executive & Writing Desks',
    slug: 'executive-desks',
    description: 'Architectural solid walnut and white oak desks with concealed cable management.',
    imageUrl: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
    seoTitle: 'Executive & Writing Desks | Kanso Atelier',
    seoDescription: 'Minimalist solid walnut and white oak office desks.',
    sortOrder: 1,
  });

  const catOfficeChairs = await upsertCategory({
    parentId: catOffice.id,
    name: 'Ergonomic Office Chairs',
    slug: 'ergonomic-office-chairs',
    description: 'Bent-walnut and tailored leather swivel task chairs built for full-day posture support.',
    imageUrl: '/src/assets/images/furniture_office_chair_1794755052211.jpg',
    seoTitle: 'Ergonomic Office Chairs | Kanso Atelier',
    seoDescription: 'Sculpted walnut and full-grain leather ergonomic desk chairs.',
    sortOrder: 2,
  });

  const catOfficeStorage = await upsertCategory({
    parentId: catOffice.id,
    name: 'Office Storage & Credenzas',
    slug: 'office-storage-credenzas',
    description: 'Boardroom sideboards, studio filing credenzas, and modular shelving.',
    imageUrl: '/src/assets/images/furniture_oak_credenza_1794755051893.jpg',
    seoTitle: 'Office Storage & Credenzas | Kanso Atelier',
    seoDescription: 'Boardroom and private office credenzas in white oak and travertine.',
    sortOrder: 3,
  });

  // 4. Attributes & Values lookup / additions
  const allAttrs = await db.select().from(attributes);
  const attrColor = allAttrs.find((a) => a.slug === 'color');
  const attrSize = allAttrs.find((a) => a.slug === 'size');
  const existingVals = await db.select().from(attributeValues);

  const ensureVal = async (attributeId: number | undefined, value: string, slug: string, colorHex = '', sortOrder = 10) => {
    if (!attributeId) return null;
    const found = existingVals.find((v) => v.attributeId === attributeId && v.slug === slug);
    if (found) return found;
    const [ins] = await db
      .insert(attributeValues)
      .values({ attributeId, value, slug, colorHex, sortOrder })
      .returning();
    existingVals.push(ins);
    return ins;
  };

  const vWalnut = await ensureVal(attrColor?.id, 'Smoked Walnut', 'smoked-walnut', '#5C4033', 6);
  const vBoucle = await ensureVal(attrColor?.id, 'Oatmeal Bouclé', 'oatmeal-boucle', '#E5DED3', 7);
  const vEspresso = await ensureVal(attrColor?.id, 'Espresso Leather', 'espresso-leather', '#3B2F2F', 8);
  const vOak = existingVals.find((v) => v.slug === 'natural-oak') || (await ensureVal(attrColor?.id, 'Natural Oak', 'natural-oak', '#C8A575', 3));
  const vBlack = existingVals.find((v) => v.slug === 'matte-black') || (await ensureVal(attrColor?.id, 'Matte Black', 'matte-black', '#18181B', 1));
  const vStandard = existingVals.find((v) => v.slug === 'standard') || (await ensureVal(attrSize?.id, 'Standard', 'standard', '', 2));
  const vGrand = existingVals.find((v) => v.slug === 'grand') || (await ensureVal(attrSize?.id, 'Grand', 'grand', '', 3));

  // Brands lookup
  const allBrands = await db.select().from(brands);
  const brandNordic = allBrands.find((b) => b.slug === 'nordic-form') || allBrands[0];
  const brandKanso = allBrands.find((b) => b.slug === 'kanso-studio') || allBrands[0];

  // Demote non-furniture items from top-3 featured so flagship Home & Office pieces lead Signature Pieces
  await db
    .update(products)
    .set({ isFeatured: false, isNew: false })
    .where(eq(products.slug, 'brannan-modular-travertine-desk-set'));
  await db
    .update(products)
    .set({ isFeatured: false })
    .where(eq(products.slug, 'faceted-spun-brass-dome-pendant'));
  await db
    .update(products)
    .set({ isFeatured: false })
    .where(eq(products.slug, 'monolith-articulated-task-lamp'));

  // Link existing complementary pieces to Home / Office categories
  const existingProds = await db.select().from(products);
  const prodBySlug = new Map(existingProds.map((p) => [p.slug, p]));
  const stoolExisting = prodBySlug.get('aethel-solid-oak-joinery-stool');
  if (stoolExisting) {
    await db
      .insert(productCategories)
      .values({ productId: stoolExisting.id, categoryId: catHome.id, isPrimary: false })
      .onConflictDoNothing();
  }
  const lampExisting = prodBySlug.get('monolith-articulated-task-lamp');
  if (lampExisting) {
    await db
      .insert(productCategories)
      .values({ productId: lampExisting.id, categoryId: catOffice.id, isPrimary: false })
      .onConflictDoNothing();
  }

  // 5. Insert Flagship Home & Office Furniture Products
  const furnitureProducts = [
    {
      name: 'Kyoto Low-Profile Bouclé Lounge Chair',
      sku: 'KA-HM-101',
      slug: 'kyoto-boucle-lounge-chair',
      shortDescription: 'Sculpted solid white oak frame upholstered in heavyweight Belgian oatmeal bouclé.',
      fullDescription:
        'Designed for residential living rooms, reading corners, and quiet studio reception lounges. Features steam-bent solid European white oak armrests with mortise joinery and dual-density pocket-coil cushioning wrapped in contract-grade Belgian bouclé.',
      mainImageUrl: '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
      galleryImages: [
        '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
        '/src/assets/images/hero_home_office_furniture_1794755051626.jpg',
      ],
      imageAlt: 'Kyoto Low-Profile Bouclé Lounge Chair in Oatmeal Bouclé and White Oak',
      brandId: brandNordic?.id || null,
      tags: ['home-furniture', 'lounge-chair', 'living-room', 'boucle', 'white-oak'],
      status: 'published',
      isFeatured: true,
      isNew: true,
      productType: 'variable',
      regularPrice: 1290,
      salePrice: 1090,
      costPrice: 540,
      stockQuantity: 14,
      stockStatus: 'in_stock',
      weight: 21.5,
      dimensions: { length: 78, width: 82, height: 74, unit: 'cm' },
      specifications: [
        { label: 'Frame Timber', value: 'FSC-Certified Solid European White Oak' },
        { label: 'Upholstery', value: 'Belgian Wool-Blend Bouclé (80,000 Martindale)' },
        { label: 'Seat Height', value: '41 cm residential lounge posture' },
        { label: 'Assembly', value: 'Delivered fully assembled in protective crate' },
      ],
      seoTitle: 'Kyoto Low-Profile Bouclé Lounge Chair | Kanso Atelier',
      metaDescription: 'Sculpted white oak and Belgian bouclé lounge armchair for modern living rooms and studios.',
      assignedAttributes: attrColor && attrSize && vBoucle && vOak && vStandard && vGrand
        ? [
            { attributeId: attrColor.id, valueIds: [vBoucle.id, vOak.id], usedForVariations: true },
            { attributeId: attrSize.id, valueIds: [vStandard.id, vGrand.id], usedForVariations: true },
          ]
        : [],
      categoryIds: [catHome.id, catLivingSeating.id],
      primaryCatId: catLivingSeating.id,
      variations: attrColor && attrSize && vBoucle && vEspresso && vStandard && vGrand
        ? [
            {
              sku: 'KA-HM-101-BCL-STD',
              regularPrice: 1290,
              salePrice: 1090,
              stockQuantity: 9,
              imageUrl: '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
              attributes: [
                { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: vBoucle.id, value: 'Oatmeal Bouclé', colorHex: '#E5DED3' },
                { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: vStandard.id, value: 'Standard' },
              ],
            },
            {
              sku: 'KA-HM-101-BCL-GRD',
              regularPrice: 1490,
              salePrice: 1290,
              stockQuantity: 5,
              imageUrl: '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
              attributes: [
                { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: vBoucle.id, value: 'Oatmeal Bouclé', colorHex: '#E5DED3' },
                { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: vGrand.id, value: 'Grand' },
              ],
            },
          ]
        : [],
    },
    {
      name: 'Atelier Solid Walnut Executive Desk',
      sku: 'KA-OF-201',
      slug: 'atelier-solid-walnut-executive-desk',
      shortDescription: 'Architectural American walnut workstation with beveled apron, soft-close drawer, and cable trough.',
      fullDescription:
        'Built for focused home studies and executive offices. The Atelier Desk pairs a 32mm solid American walnut worktop with a matte powder-coated architectural steel underframe, an integrated flush recessed device tray, and a full-width felt-lined center drawer.',
      mainImageUrl: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
      galleryImages: [
        '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
        '/src/assets/images/hero_home_office_furniture_1794755051626.jpg',
      ],
      imageAlt: 'Atelier Solid Walnut Executive Desk with Matte Black Steel Legs',
      brandId: brandKanso?.id || null,
      tags: ['office-furniture', 'executive-desk', 'home-office', 'walnut', 'workstation'],
      status: 'published',
      isFeatured: true,
      isNew: true,
      productType: 'variable',
      regularPrice: 1850,
      salePrice: 1590,
      costPrice: 780,
      stockQuantity: 11,
      stockStatus: 'in_stock',
      weight: 48,
      dimensions: { length: 160, width: 78, height: 75, unit: 'cm' },
      specifications: [
        { label: 'Desktop Material', value: 'Solid Kiln-Dried American Black Walnut' },
        { label: 'Underframe', value: 'Textured Matte Black Architectural Steel' },
        { label: 'Cable Management', value: 'Concealed magnetic rear power channel' },
        { label: 'Drawer Hardware', value: 'Concealed Blum soft-close runners' },
      ],
      seoTitle: 'Atelier Solid Walnut Executive Desk | Kanso Atelier',
      metaDescription: 'Minimalist solid walnut executive office desk with integrated cable channel and steel frame.',
      assignedAttributes: attrColor && attrSize && vWalnut && vOak && vStandard && vGrand
        ? [
            { attributeId: attrColor.id, valueIds: [vWalnut.id, vOak.id], usedForVariations: true },
            { attributeId: attrSize.id, valueIds: [vStandard.id, vGrand.id], usedForVariations: true },
          ]
        : [],
      categoryIds: [catOffice.id, catExecDesks.id, catHome.id],
      primaryCatId: catExecDesks.id,
      variations: attrColor && attrSize && vWalnut && vOak && vStandard && vGrand
        ? [
            {
              sku: 'KA-OF-201-WLN-STD',
              regularPrice: 1850,
              salePrice: 1590,
              stockQuantity: 7,
              imageUrl: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
              attributes: [
                { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: vWalnut.id, value: 'Smoked Walnut', colorHex: '#5C4033' },
                { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: vStandard.id, value: 'Standard' },
              ],
            },
            {
              sku: 'KA-OF-201-WLN-GRD',
              regularPrice: 2150,
              salePrice: 1890,
              stockQuantity: 4,
              imageUrl: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
              attributes: [
                { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: vWalnut.id, value: 'Smoked Walnut', colorHex: '#5C4033' },
                { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: vGrand.id, value: 'Grand' },
              ],
            },
          ]
        : [],
    },
    {
      name: 'Aeronaut Sculpted Walnut Office Chair',
      sku: 'KA-OF-202',
      slug: 'aeronaut-sculpted-walnut-office-chair',
      shortDescription: 'Curved molded walnut shell, tailored full-grain leather seating, and synchro-tilt aluminum base.',
      fullDescription:
        'Uniting mid-century craftsmanship with modern ergonomic mechanics, the Aeronaut Task Chair cradles the lumbar spine inside a bent-walnut veneer outer shell upholstered in full-grain espresso leather on a cast aluminum five-star swivel base.',
      mainImageUrl: '/src/assets/images/furniture_office_chair_1794755052211.jpg',
      galleryImages: ['/src/assets/images/furniture_office_chair_1794755052211.jpg'],
      imageAlt: 'Aeronaut Sculpted Walnut and Leather Ergonomic Office Chair',
      brandId: brandKanso?.id || null,
      tags: ['office-furniture', 'ergonomic-chair', 'office-chair', 'leather', 'walnut'],
      status: 'published',
      isFeatured: true,
      isNew: false,
      productType: 'variable',
      regularPrice: 890,
      salePrice: 745,
      costPrice: 360,
      stockQuantity: 20,
      stockStatus: 'in_stock',
      weight: 18.2,
      dimensions: { length: 66, width: 64, height: 108, unit: 'cm' },
      specifications: [
        { label: 'Shell', value: '11-ply Bookmatched American Walnut Veneer' },
        { label: 'Upholstery', value: 'Full-Grain Aniline Espresso Leather' },
        { label: 'Base & Casters', value: 'Die-cast brushed aluminum + silent polyurethane casters' },
        { label: 'Mechanism', value: 'Pneumatic lift with 3-position tension tilt lock' },
      ],
      seoTitle: 'Aeronaut Sculpted Walnut Office Chair | Kanso Atelier',
      metaDescription: 'Ergonomic bent-walnut and leather executive office task chair with brushed aluminum swivel base.',
      assignedAttributes: attrColor && attrSize && vEspresso && vBlack && vStandard
        ? [
            { attributeId: attrColor.id, valueIds: [vEspresso.id, vBlack.id], usedForVariations: true },
            { attributeId: attrSize.id, valueIds: [vStandard.id], usedForVariations: true },
          ]
        : [],
      categoryIds: [catOffice.id, catOfficeChairs.id],
      primaryCatId: catOfficeChairs.id,
      variations: attrColor && attrSize && vEspresso && vBlack && vStandard
        ? [
            {
              sku: 'KA-OF-202-ESP-STD',
              regularPrice: 890,
              salePrice: 745,
              stockQuantity: 14,
              imageUrl: '/src/assets/images/furniture_office_chair_1794755052211.jpg',
              attributes: [
                { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: vEspresso.id, value: 'Espresso Leather', colorHex: '#3B2F2F' },
                { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: vStandard.id, value: 'Standard' },
              ],
            },
            {
              sku: 'KA-OF-202-BLK-STD',
              regularPrice: 890,
              salePrice: 745,
              stockQuantity: 6,
              imageUrl: '/src/assets/images/furniture_office_chair_1794755052211.jpg',
              attributes: [
                { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: vBlack.id, value: 'Matte Black', colorHex: '#18181B' },
                { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: vStandard.id, value: 'Standard' },
              ],
            },
          ]
        : [],
    },
    {
      name: 'Soren Slatted Oak & Travertine Credenza',
      sku: 'KA-HM-102',
      slug: 'soren-slatted-oak-travertine-credenza',
      shortDescription: 'Four-door architectural white oak sideboard crowned with honed Roman travertine stone.',
      fullDescription:
        'Equally at home in open-plan dining rooms or executive boardrooms, the Soren Credenza features vertically fluted solid white oak doors with soft-close concealed hinges, adjustable interior shelving with cable pass-throughs, and a 25mm honed travertine slab top.',
      mainImageUrl: '/src/assets/images/furniture_oak_credenza_1794755051893.jpg',
      galleryImages: [
        '/src/assets/images/furniture_oak_credenza_1794755051893.jpg',
        '/src/assets/images/hero_home_office_furniture_1794755051626.jpg',
      ],
      imageAlt: 'Soren Slatted White Oak and Travertine Credenza Sideboard',
      brandId: brandNordic?.id || null,
      tags: ['home-furniture', 'office-furniture', 'credenza', 'sideboard', 'storage', 'white-oak'],
      status: 'published',
      isFeatured: false,
      isNew: true,
      productType: 'variable',
      regularPrice: 2150,
      salePrice: 1890,
      costPrice: 920,
      stockQuantity: 8,
      stockStatus: 'in_stock',
      weight: 68,
      dimensions: { length: 180, width: 46, height: 76, unit: 'cm' },
      specifications: [
        { label: 'Cabinet Body', value: 'Solid & Quarter-Sawn European White Oak' },
        { label: 'Top Slab', value: '25mm Honed Unfilled Roman Travertine' },
        { label: 'Base', value: '25mm Powder-Coated Steel Plinth' },
        { label: 'Interior', value: '4 Adjustable shelves + rear acoustic/cable vents' },
      ],
      seoTitle: 'Soren Slatted Oak & Travertine Credenza | Kanso Atelier',
      metaDescription: 'Four-door slatted white oak sideboard with Roman travertine top for home and office interiors.',
      assignedAttributes: attrColor && attrSize && vOak && vWalnut && vStandard && vGrand
        ? [
            { attributeId: attrColor.id, valueIds: [vOak.id, vWalnut.id], usedForVariations: true },
            { attributeId: attrSize.id, valueIds: [vStandard.id, vGrand.id], usedForVariations: true },
          ]
        : [],
      categoryIds: [catHome.id, catHomeStorage.id, catOffice.id, catOfficeStorage.id],
      primaryCatId: catHomeStorage.id,
      variations: attrColor && attrSize && vOak && vStandard && vGrand
        ? [
            {
              sku: 'KA-HM-102-OAK-STD',
              regularPrice: 2150,
              salePrice: 1890,
              stockQuantity: 5,
              imageUrl: '/src/assets/images/furniture_oak_credenza_1794755051893.jpg',
              attributes: [
                { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: vOak.id, value: 'Natural Oak', colorHex: '#C8A575' },
                { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: vStandard.id, value: 'Standard' },
              ],
            },
            {
              sku: 'KA-HM-102-OAK-GRD',
              regularPrice: 2490,
              salePrice: 2190,
              stockQuantity: 3,
              imageUrl: '/src/assets/images/furniture_oak_credenza_1794755051893.jpg',
              attributes: [
                { attributeId: attrColor.id, attributeName: 'Finish / Color', attributeSlug: 'color', valueId: vOak.id, value: 'Natural Oak', colorHex: '#C8A575' },
                { attributeId: attrSize.id, attributeName: 'Size', attributeSlug: 'size', valueId: vGrand.id, value: 'Grand' },
              ],
            },
          ]
        : [],
    },
    {
      name: 'Veranda Architectural Study & Dining Table',
      sku: 'KA-OF-203',
      slug: 'veranda-architectural-study-table',
      shortDescription: 'Generous solid timber conference, studio worktable, and residential dining centerpiece.',
      fullDescription:
        'Designed to bridge residential dining rooms and collaborative design studios, the Veranda Table seats six to eight comfortably with chamfered solid hardwood edges and rigid architectural steel trestle joinery.',
      mainImageUrl: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
      galleryImages: ['/src/assets/images/furniture_executive_desk_1794755052336.jpg'],
      imageAlt: 'Veranda Architectural Solid Timber Study and Dining Table',
      brandId: brandNordic?.id || null,
      tags: ['home-furniture', 'office-furniture', 'dining-table', 'conference-table', 'walnut'],
      status: 'published',
      isFeatured: false,
      isNew: false,
      productType: 'simple',
      regularPrice: 1620,
      salePrice: 1420,
      costPrice: 690,
      stockQuantity: 9,
      stockStatus: 'in_stock',
      weight: 54,
      dimensions: { length: 210, width: 95, height: 75, unit: 'cm' },
      specifications: [
        { label: 'Top', value: 'Solid Oiled Walnut & Chamfered Edge Profile' },
        { label: 'Seating Capacity', value: '6–8 Chairs comfortably' },
        { label: 'Finish', value: 'Zero-VOC plant-based matte hardwax oil' },
      ],
      seoTitle: 'Veranda Architectural Study & Dining Table | Kanso Atelier',
      metaDescription: 'Solid walnut worktable and residential dining table with steel trestle legs.',
      assignedAttributes: [],
      categoryIds: [catOffice.id, catExecDesks.id, catHome.id],
      primaryCatId: catHome.id,
      variations: [],
    },
  ];

  const varAttrRows: Array<{ variationId: number; attributeId: number; attributeValueId: number }> = [];

  for (const item of furnitureProducts) {
    const existingP = prodBySlug.get(item.slug);
    if (existingP) continue;

    const { categoryIds, primaryCatId, variations, ...productInsert } = item;
    const [insertedProd] = await db.insert(products).values(productInsert).returning();

    for (const cid of categoryIds) {
      await db
        .insert(productCategories)
        .values({ productId: insertedProd.id, categoryId: cid, isPrimary: cid === primaryCatId })
        .onConflictDoNothing();
    }

    if (variations.length > 0) {
      const insertedVars = await db
        .insert(productVariations)
        .values(
          variations.map((v) => ({
            productId: insertedProd.id,
            sku: v.sku,
            regularPrice: v.regularPrice,
            salePrice: v.salePrice,
            stockQuantity: v.stockQuantity,
            imageUrl: v.imageUrl,
            attributes: v.attributes,
          }))
        )
        .returning();

      for (const v of insertedVars) {
        for (const a of v.attributes || []) {
          varAttrRows.push({
            variationId: v.id,
            attributeId: a.attributeId,
            attributeValueId: a.valueId,
          });
        }
      }
    }
  }

  if (varAttrRows.length > 0) {
    await db.insert(variationAttributeValues).values(varAttrRows);
  }

  // 6. Enrich About Us page copy for Home & Office Furniture
  await db
    .update(websitePages)
    .set({
      title: 'About Us',
      content:
        'Founded in San Francisco, Kanso Atelier designs and curates architectural home and office furniture built to outlast seasonal trends. From solid walnut executive desks and ergonomic leather task chairs to residential bouclé lounge seating and slatted oak credenzas, every piece is available for direct home delivery (Cash on Delivery) or custom commercial project quotation.',
      seoTitle: 'About Kanso Atelier – Home & Office Furniture Craftsmanship',
      metaDescription: 'Learn about Kanso Atelier home and office furniture craftsmanship, FSC hardwoods, and architectural services.',
    })
    .where(eq(websitePages.slug, 'about-us'));

  // 7. Record one-time enrichment marker
  await db.insert(settings).values({
    key: 'catalog_home_office_v1',
    category: 'system',
    value: { appliedAt: new Date().toISOString() },
  });
}
