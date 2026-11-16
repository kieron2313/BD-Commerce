import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// 1. RBAC: ROLES, PERMISSIONS & USERS
// ============================================================================

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable(
  'permissions',
  {
    id: serial('id').primaryKey(),
    roleId: integer('role_id')
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    module: text('module').notNull(), // products, orders, inquiries, quotations, settings, etc.
    canView: boolean('can_view').default(true).notNull(),
    canCreate: boolean('can_create').default(false).notNull(),
    canEdit: boolean('can_edit').default(false).notNull(),
    canDelete: boolean('can_delete').default(false).notNull(),
  },
  (table) => [uniqueIndex('role_module_idx').on(table.roleId, table.module)]
);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name').default(''),
  photoUrl: text('photo_url').default(''),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// 2. CUSTOMERS
// ============================================================================

export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').default(''),
    companyName: text('company_name').default(''),
    billingAddress: text('billing_address').default(''),
    shippingAddress: text('shipping_address').default(''),
    city: text('city').default(''),
    stateRegion: text('state_region').default(''),
    postalCode: text('postal_code').default(''),
    country: text('country').default(''),
    notes: text('notes').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('customers_email_idx').on(table.email)]
);

// ============================================================================
// 3. MEDIA LIBRARY
// ============================================================================

export const mediaLibrary = pgTable('media_library', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url').default(''),
  altText: text('alt_text').default(''),
  mimeType: text('mime_type').default('image/jpeg'),
  sizeBytes: integer('size_bytes').default(0),
  width: integer('width').default(0),
  height: integer('height').default(0),
  folder: text('folder').default('general'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 4. CATEGORIES & BRANDS
// ============================================================================

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    parentId: integer('parent_id'),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').default(''),
    imageUrl: text('image_url').default(''),
    icon: text('icon').default(''),
    seoTitle: text('seo_title').default(''),
    seoDescription: text('seo_description').default(''),
    status: text('status').default('active').notNull(), // active | inactive
    sortOrder: integer('sort_order').default(0).notNull(),
    priceVisibility: text('price_visibility').default('inherit').notNull(), // inherit | show | hide
    stockVisibility: text('stock_visibility').default('inherit').notNull(),
    inquiryEnabled: text('inquiry_enabled').default('inherit').notNull(), // inherit | enable | disable
    displayLayout: text('display_layout').default('grid').notNull(), // grid | list
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('categories_parent_idx').on(table.parentId)]
);

export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url').default(''),
  description: text('description').default(''),
  seoTitle: text('seo_title').default(''),
  seoDescription: text('seo_description').default(''),
  status: text('status').default('active').notNull(), // active | inactive
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 5. ATTRIBUTES & PRODUCT VARIATIONS
// ============================================================================

export const attributes = pgTable('attributes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  displayType: text('display_type').default('button').notNull(), // swatch | button | dropdown
  usedForVariations: boolean('used_for_variations').default(true).notNull(),
  usedForFiltering: boolean('used_for_filtering').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const attributeValues = pgTable(
  'attribute_values',
  {
    id: serial('id').primaryKey(),
    attributeId: integer('attribute_id')
      .references(() => attributes.id, { onDelete: 'cascade' })
      .notNull(),
    value: text('value').notNull(),
    slug: text('slug').notNull(),
    colorHex: text('color_hex').default(''),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (table) => [index('attr_values_attr_idx').on(table.attributeId)]
);

// ============================================================================
// 6. PRODUCTS & PRODUCT RELATIONSHIPS
// ============================================================================

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    sku: text('sku').notNull().unique(),
    slug: text('slug').notNull().unique(),
    shortDescription: text('short_description').default(''),
    fullDescription: text('full_description').default(''),
    mainImageUrl: text('main_image_url').default(''),
    galleryImages: jsonb('gallery_images').$type<string[]>().default([]),
    imageAlt: text('image_alt').default(''),
    brandId: integer('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    tags: jsonb('tags').$type<string[]>().default([]),
    status: text('status').default('published').notNull(), // published | draft | archived
    isFeatured: boolean('is_featured').default(false).notNull(),
    isNew: boolean('is_new').default(false).notNull(),
    specifications: jsonb('specifications')
      .$type<Array<{ label: string; value: string }>>()
      .default([]),
    relatedProductIds: jsonb('related_product_ids').$type<number[]>().default([]),
    crossSellProductIds: jsonb('cross_sell_product_ids').$type<number[]>().default([]),
    upsellProductIds: jsonb('upsell_product_ids').$type<number[]>().default([]),
    productType: text('product_type').default('simple').notNull(), // simple | variable
    // Commercial fields
    regularPrice: doublePrecision('regular_price').default(0).notNull(),
    salePrice: doublePrecision('sale_price'),
    saleStartDate: timestamp('sale_start_date'),
    saleEndDate: timestamp('sale_end_date'),
    costPrice: doublePrecision('cost_price').default(0),
    taxClass: text('tax_class').default('standard').notNull(),
    stockQuantity: integer('stock_quantity').default(0).notNull(),
    stockStatus: text('stock_status').default('in_stock').notNull(), // in_stock | out_of_stock | on_backorder
    allowBackorder: boolean('allow_backorder').default(false).notNull(),
    minOrderQty: integer('min_order_qty').default(1).notNull(),
    maxOrderQty: integer('max_order_qty'),
    weight: doublePrecision('weight').default(0),
    dimensions: jsonb('dimensions')
      .$type<{ length: number; width: number; height: number; unit: string }>()
      .default({ length: 0, width: 0, height: 0, unit: 'cm' }),
    // Visibility overrides
    priceVisibility: text('price_visibility').default('inherit').notNull(), // inherit | show | hide
    salePriceVisibility: text('sale_price_visibility').default('inherit').notNull(),
    stockVisibility: text('stock_visibility').default('inherit').notNull(),
    skuVisibility: text('sku_visibility').default('inherit').notNull(),
    inquiryEnabled: text('inquiry_enabled').default('inherit').notNull(), // inherit | enable | disable
    quantityEnabled: text('quantity_enabled').default('inherit').notNull(),
    quoteEnabled: text('quote_enabled').default('inherit').notNull(),
    // SEO fields
    seoTitle: text('seo_title').default(''),
    metaDescription: text('meta_description').default(''),
    canonicalUrl: text('canonical_url').default(''),
    // Assigned product attributes (for variable & filterable products)
    assignedAttributes: jsonb('assigned_attributes')
      .$type<Array<{ attributeId: number; valueIds: number[]; usedForVariations: boolean }>>()
      .default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('products_status_idx').on(table.status),
    index('products_brand_idx').on(table.brandId),
  ]
);

export const productCategories = pgTable(
  'product_categories',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
  },
  (table) => [uniqueIndex('product_cat_unique').on(table.productId, table.categoryId)]
);

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  altText: text('alt_text').default(''),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export interface VariationAttributeSnapshot {
  attributeId: number;
  attributeName: string;
  attributeSlug: string;
  valueId: number;
  value: string;
  colorHex?: string;
}

export const productVariations = pgTable(
  'product_variations',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    sku: text('sku').notNull().unique(),
    regularPrice: doublePrecision('regular_price').default(0).notNull(),
    salePrice: doublePrecision('sale_price'),
    saleStartDate: timestamp('sale_start_date'),
    saleEndDate: timestamp('sale_end_date'),
    stockQuantity: integer('stock_quantity').default(0).notNull(),
    stockStatus: text('stock_status').default('in_stock').notNull(),
    backorderStatus: text('backorder_status').default('no').notNull(), // no | notify | yes
    imageUrl: text('image_url').default(''),
    galleryImages: jsonb('gallery_images').$type<string[]>().default([]),
    weight: doublePrecision('weight').default(0),
    dimensions: jsonb('dimensions')
      .$type<{ length: number; width: number; height: number; unit: string }>()
      .default({ length: 0, width: 0, height: 0, unit: 'cm' }),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    attributes: jsonb('attributes').$type<VariationAttributeSnapshot[]>().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('variations_product_idx').on(table.productId)]
);

export const variationAttributeValues = pgTable(
  'variation_attribute_values',
  {
    id: serial('id').primaryKey(),
    variationId: integer('variation_id')
      .references(() => productVariations.id, { onDelete: 'cascade' })
      .notNull(),
    attributeId: integer('attribute_id')
      .references(() => attributes.id, { onDelete: 'cascade' })
      .notNull(),
    attributeValueId: integer('attribute_value_id')
      .references(() => attributeValues.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [uniqueIndex('var_attr_val_idx').on(table.variationId, table.attributeId)]
);

export const inventoryLogs = pgTable('inventory_logs', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  variationId: integer('variation_id').references(() => productVariations.id, {
    onDelete: 'set null',
  }),
  sku: text('sku').notNull(),
  changeAmount: integer('change_amount').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason').notNull(),
  reference: text('reference').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 7. CARTS (PERSISTENT ECOMMERCE & INQUIRY)
// ============================================================================

export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  couponCode: text('coupon_code').default(''),
  shippingMethodId: integer('shipping_method_id'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: serial('id').primaryKey(),
    cartId: integer('cart_id')
      .references(() => carts.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    variationId: integer('variation_id').references(() => productVariations.id, {
      onDelete: 'cascade',
    }),
    quantity: integer('quantity').default(1).notNull(),
    selectedAttributes: jsonb('selected_attributes')
      .$type<VariationAttributeSnapshot[]>()
      .default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('cart_items_cart_idx').on(table.cartId)]
);

// ============================================================================
// 8. COUPONS & SHIPPING
// ============================================================================

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').default(''),
  discountType: text('discount_type').default('percentage').notNull(), // fixed | percentage | free_shipping
  discountValue: doublePrecision('discount_value').default(0).notNull(),
  startDate: timestamp('start_date'),
  expirationDate: timestamp('expiration_date'),
  minPurchaseAmount: doublePrecision('min_purchase_amount').default(0),
  maxDiscountAmount: doublePrecision('max_discount_amount'),
  maxUsage: integer('max_usage'),
  usageLimitPerCustomer: integer('usage_limit_per_customer'),
  usageCount: integer('usage_count').default(0).notNull(),
  applicableProductIds: jsonb('applicable_product_ids').$type<number[]>().default([]),
  applicableCategoryIds: jsonb('applicable_category_ids').$type<number[]>().default([]),
  excludedProductIds: jsonb('excluded_product_ids').$type<number[]>().default([]),
  excludedCategoryIds: jsonb('excluded_category_ids').$type<number[]>().default([]),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  countries: jsonb('countries').$type<string[]>().default([]),
  regions: jsonb('regions').$type<string[]>().default([]),
  postalCodes: jsonb('postal_codes').$type<string[]>().default([]),
  isActive: boolean('is_active').default(true).notNull(),
});

export const shippingMethods = pgTable('shipping_methods', {
  id: serial('id').primaryKey(),
  zoneId: integer('zone_id').references(() => shippingZones.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description').default(''),
  price: doublePrecision('price').default(0).notNull(),
  freeShippingThreshold: doublePrecision('free_shipping_threshold'),
  estimatedDeliveryTime: text('estimated_delivery_time').default('3-5 business days'),
  countries: jsonb('countries').$type<string[]>().default([]),
  regions: jsonb('regions').$type<string[]>().default([]),
  postalCodes: jsonb('postal_codes').$type<string[]>().default([]),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

// ============================================================================
// 9. ORDERS (ECOMMERCE MODE & QUOTATION CONVERSIONS)
// ============================================================================

export interface AddressSnapshot {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    customerEmail: text('customer_email').notNull(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').default(''),
    companyName: text('company_name').default(''),
    billingAddress: jsonb('billing_address').$type<AddressSnapshot>().notNull(),
    shippingAddress: jsonb('shipping_address').$type<AddressSnapshot>().notNull(),
    shippingMethodId: integer('shipping_method_id'),
    shippingMethodName: text('shipping_method_name').default('Standard Shipping'),
    shippingCost: doublePrecision('shipping_cost').default(0).notNull(),
    subtotal: doublePrecision('subtotal').default(0).notNull(),
    couponCode: text('coupon_code').default(''),
    discountAmount: doublePrecision('discount_amount').default(0).notNull(),
    taxAmount: doublePrecision('tax_amount').default(0).notNull(),
    totalAmount: doublePrecision('total_amount').default(0).notNull(),
    paymentMethod: text('payment_method').default('cod').notNull(), // cod (extensible for stripe, paypal, bank)
    paymentStatus: text('payment_status').default('unpaid').notNull(), // unpaid | paid | partially_paid | refunded
    orderStatus: text('order_status').default('pending').notNull(), // pending | processing | on_hold | shipped | completed | cancelled | refunded
    customerNotes: text('customer_notes').default(''),
    internalNotes: text('internal_notes').default(''),
    sourceQuotationId: integer('source_quotation_id'),
    sourceInquiryId: integer('source_inquiry_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_email_idx').on(table.customerEmail),
    index('orders_status_idx').on(table.orderStatus),
  ]
);

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  variationId: integer('variation_id').references(() => productVariations.id, {
    onDelete: 'set null',
  }),
  productName: text('product_name').notNull(),
  productImage: text('product_image').default(''),
  sku: text('sku').notNull(),
  variationLabel: text('variation_label').default(''),
  unitPrice: doublePrecision('unit_price').default(0).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  lineTotal: doublePrecision('line_total').default(0).notNull(),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().default({}),
});

export const orderHistory = pgTable('order_history', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  orderStatus: text('order_status').notNull(),
  paymentStatus: text('payment_status').notNull(),
  note: text('note').default(''),
  changedBy: text('changed_by').default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const couponUsage = pgTable('coupon_usage', {
  id: serial('id').primaryKey(),
  couponId: integer('coupon_id')
    .references(() => coupons.id, { onDelete: 'cascade' })
    .notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  customerEmail: text('customer_email').notNull(),
  discountApplied: doublePrecision('discount_applied').default(0).notNull(),
  usedAt: timestamp('used_at').defaultNow().notNull(),
});

// ============================================================================
// 10. INQUIRIES & QUOTATIONS (CATALOGUE MODE)
// ============================================================================

export const inquiries = pgTable(
  'inquiries',
  {
    id: serial('id').primaryKey(),
    inquiryRef: text('inquiry_ref').notNull().unique(),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    customerName: text('customer_name').notNull(),
    companyName: text('company_name').default(''),
    email: text('email').notNull(),
    phone: text('phone').default(''),
    message: text('message').default(''),
    preferredShippingMethod: text('preferred_shipping_method').default(''),
    status: text('status').default('new').notNull(), // new | in_review | quoted | responded | converted | closed
    internalNotes: text('internal_notes').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('inquiries_email_idx').on(table.email)]
);

export const inquiryItems = pgTable('inquiry_items', {
  id: serial('id').primaryKey(),
  inquiryId: integer('inquiry_id')
    .references(() => inquiries.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  variationId: integer('variation_id').references(() => productVariations.id, {
    onDelete: 'set null',
  }),
  productName: text('product_name').notNull(),
  productImage: text('product_image').default(''),
  sku: text('sku').notNull(),
  variationLabel: text('variation_label').default(''),
  quantity: integer('quantity').default(1).notNull(),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().default({}),
});

export const quotations = pgTable(
  'quotations',
  {
    id: serial('id').primaryKey(),
    quoteRef: text('quote_ref').notNull().unique(),
    secureToken: text('secure_token').notNull().unique(),
    inquiryId: integer('inquiry_id').references(() => inquiries.id, { onDelete: 'set null' }),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    customerName: text('customer_name').notNull(),
    companyName: text('company_name').default(''),
    email: text('email').notNull(),
    phone: text('phone').default(''),
    status: text('status').default('draft').notNull(), // draft | sent | viewed | accepted | rejected | expired
    discountType: text('discount_type').default('fixed').notNull(), // fixed | percentage
    discountValue: doublePrecision('discount_value').default(0).notNull(),
    shippingCost: doublePrecision('shipping_cost').default(0).notNull(),
    taxRate: doublePrecision('tax_rate').default(0).notNull(),
    taxAmount: doublePrecision('tax_amount').default(0).notNull(),
    additionalFees: doublePrecision('additional_fees').default(0).notNull(),
    subtotal: doublePrecision('subtotal').default(0).notNull(),
    totalDiscount: doublePrecision('total_discount').default(0).notNull(),
    grandTotal: doublePrecision('grand_total').default(0).notNull(),
    notes: text('notes').default(''),
    customerComments: text('customer_comments').default(''),
    expiresAt: timestamp('expires_at'),
    sentAt: timestamp('sent_at'),
    viewedAt: timestamp('viewed_at'),
    respondedAt: timestamp('responded_at'),
    convertedOrderId: integer('converted_order_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('quotations_email_idx').on(table.email)]
);

export const quotationItems = pgTable('quotation_items', {
  id: serial('id').primaryKey(),
  quotationId: integer('quotation_id')
    .references(() => quotations.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  variationId: integer('variation_id').references(() => productVariations.id, {
    onDelete: 'set null',
  }),
  productName: text('product_name').notNull(),
  productImage: text('product_image').default(''),
  sku: text('sku').notNull(),
  variationLabel: text('variation_label').default(''),
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: doublePrecision('unit_price').default(0).notNull(),
  lineDiscount: doublePrecision('line_discount').default(0).notNull(),
  lineTotal: doublePrecision('line_total').default(0).notNull(),
});

// ============================================================================
// 11. SETTINGS, SEO, REDIRECTS, PAGES, EMAIL TEMPLATES & NOTIFICATIONS
// ============================================================================

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  category: text('category').default('general').notNull(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const seoMetadata = pgTable(
  'seo_metadata',
  {
    id: serial('id').primaryKey(),
    entityType: text('entity_type').notNull(), // product | category | brand | page | global
    entityId: integer('entity_id').default(0).notNull(),
    metaTitle: text('meta_title').default(''),
    metaDescription: text('meta_description').default(''),
    canonicalUrl: text('canonical_url').default(''),
    ogTitle: text('og_title').default(''),
    ogDescription: text('og_description').default(''),
    ogImage: text('og_image').default(''),
    noIndex: boolean('no_index').default(false).notNull(),
  },
  (table) => [uniqueIndex('seo_entity_idx').on(table.entityType, table.entityId)]
);

export const urlRedirects = pgTable('url_redirects', {
  id: serial('id').primaryKey(),
  sourcePath: text('source_path').notNull().unique(),
  targetPath: text('target_path').notNull(),
  statusCode: integer('status_code').default(301).notNull(),
  hits: integer('hits').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const websitePages = pgTable('website_pages', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').default(''),
  seoTitle: text('seo_title').default(''),
  metaDescription: text('meta_description').default(''),
  isPublished: boolean('is_published').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailTemplates = pgTable('email_templates', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  triggerEvent: text('trigger_event').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').default('sent').notNull(),
  relatedEntityType: text('related_entity_type').default(''),
  relatedEntityId: integer('related_entity_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(permissions),
  users: many(users),
}));

export const permissionsRelations = relations(permissions, ({ one }) => ({
  role: one(roles, { fields: [permissions.roleId], references: [roles.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
}));

export const attributesRelations = relations(attributes, ({ many }) => ({
  values: many(attributeValues),
}));

export const attributeValuesRelations = relations(attributeValues, ({ one }) => ({
  attribute: one(attributes, {
    fields: [attributeValues.attributeId],
    references: [attributes.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  variations: many(productVariations),
  categories: many(productCategories),
  images: many(productImages),
}));

export const productVariationsRelations = relations(productVariations, ({ one }) => ({
  product: one(products, {
    fields: [productVariations.productId],
    references: [products.id],
  }),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  history: many(orderHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const orderHistoryRelations = relations(orderHistory, ({ one }) => ({
  order: one(orders, { fields: [orderHistory.orderId], references: [orders.id] }),
}));

export const inquiriesRelations = relations(inquiries, ({ many }) => ({
  items: many(inquiryItems),
  quotations: many(quotations),
}));

export const inquiryItemsRelations = relations(inquiryItems, ({ one }) => ({
  inquiry: one(inquiries, { fields: [inquiryItems.inquiryId], references: [inquiries.id] }),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  inquiry: one(inquiries, { fields: [quotations.inquiryId], references: [inquiries.id] }),
  items: many(quotationItems),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
}));
