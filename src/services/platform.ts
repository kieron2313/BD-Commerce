import { db } from '../db/index.ts';
import {
  settings,
  products,
  categories,
  productCategories,
  productVariations,
  coupons,
  shippingMethods,
  shippingZones,
  orders,
  orderItems,
  orderHistory,
  couponUsage,
  inquiries,
  inquiryItems,
  quotations,
  quotationItems,
  customers,
  inventoryLogs,
  emailTemplates,
  notifications,
} from '../db/schema.ts';
import { eq, inArray, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import {
  DEFAULT_EMAIL_SETTINGS_BASE,
  renderBrandedEmailHtml,
} from '../utils/emailRenderer.ts';
import { DEFAULT_INVOICE_SETTINGS } from '../utils/invoiceRenderer.ts';

export function roundMoney(val: number): number {
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

export interface PlatformSettingsBundle {
  general: Record<string, any>;
  commerce: Record<string, any>;
  catalogue: Record<string, any>;
  email: Record<string, any>;
  seo: Record<string, any>;
  invoice: Record<string, any>;
}

export const DEFAULT_EMAIL_SETTINGS = {
  ...DEFAULT_EMAIL_SETTINGS_BASE,
};

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    slug: 'order-confirmation',
    name: 'Order Confirmation (Customer)',
    subject: 'Order {{orderNumber}} Confirmed — {{siteName}}',
    bodyHtml:
      '<p style="margin:0 0 14px;">Dear <strong>{{customerName}}</strong>,</p><p style="margin:0 0 14px;">Thank you for your order <strong>{{orderNumber}}</strong> totaling <strong>{{totalAmount}}</strong> (Payment Method: Cash on Delivery).</p><p style="margin:0 0 18px;">Our studio dispatch team is preparing your items and will notify you as soon as your shipment leaves our warehouse.</p>',
    triggerEvent: 'order.created',
    isActive: true,
  },
  {
    slug: 'new-order-admin',
    name: 'New Order Alert (Admin)',
    subject: 'New Order {{orderNumber}} ({{totalAmount}}) — {{customerName}}',
    bodyHtml:
      '<p style="margin:0 0 14px;">A new Cash on Delivery order <strong>{{orderNumber}}</strong> has been placed.</p><p style="margin:0 0 14px;">Customer: <strong>{{customerName}}</strong> ({{email}})<br/>Order Total: <strong>{{totalAmount}}</strong></p><p style="margin:0;">Open the Orders tab in your admin workspace to verify and prepare dispatch.</p>',
    triggerEvent: 'order.admin_alert',
    isActive: true,
  },
  {
    slug: 'order-status-update',
    name: 'Order Status Update (Customer)',
    subject: 'Update on Order {{orderNumber}}: {{orderStatus}}',
    bodyHtml:
      '<p style="margin:0 0 14px;">Hello <strong>{{customerName}}</strong>,</p><p style="margin:0 0 14px;">Your order <strong>{{orderNumber}}</strong> has been updated to <strong>{{orderStatus}}</strong>.</p><p style="margin:0;">Payment Status: <strong>{{paymentStatus}}</strong></p>',
    triggerEvent: 'order.updated',
    isActive: true,
  },
  {
    slug: 'inquiry-confirmation',
    name: 'Inquiry Received (Customer)',
    subject: 'Specification Inquiry {{inquiryRef}} Received — {{siteName}}',
    bodyHtml:
      '<p style="margin:0 0 14px;">Dear <strong>{{customerName}}</strong>,</p><p style="margin:0 0 14px;">We have received your product inquiry <strong>{{inquiryRef}}</strong>. Our specification team is reviewing your requested items and quantities.</p><p style="margin:0;">We will deliver a formal quotation directly to your inbox within one business day.</p>',
    triggerEvent: 'inquiry.created',
    isActive: true,
  },
  {
    slug: 'new-inquiry-admin',
    name: 'New Inquiry Alert (Admin)',
    subject: 'New Catalogue Inquiry {{inquiryRef}} from {{customerName}}',
    bodyHtml:
      '<p style="margin:0 0 14px;">A new specification inquiry <strong>{{inquiryRef}}</strong> was submitted by <strong>{{customerName}}</strong> ({{email}}).</p><p style="margin:0;">Review the requested products and generate a formal quotation from the Inquiries tab.</p>',
    triggerEvent: 'inquiry.admin_alert',
    isActive: true,
  },
  {
    slug: 'quotation-sent',
    name: 'Quotation Delivery (Customer)',
    subject: 'Your Formal Quotation {{quoteRef}} from {{siteName}}',
    bodyHtml:
      '<p style="margin:0 0 14px;">Dear <strong>{{customerName}}</strong>,</p><p style="margin:0 0 18px;">Your formal quotation <strong>{{quoteRef}}</strong> for <strong>{{grandTotal}}</strong> is ready to inspect, approve, or download.</p><p style="margin:0 0 18px;"><a href="{{quoteUrl}}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#171717;color:#ffffff;text-decoration:none;font-weight:600;">Review &amp; Respond to Quotation</a></p><p style="margin:0;font-size:12px;color:#6B7280;">Direct link: {{quoteUrl}}</p>',
    triggerEvent: 'quotation.sent',
    isActive: true,
  },
  {
    slug: 'quotation-responded',
    name: 'Quotation Response Alert (Admin)',
    subject: 'Quotation {{quoteRef}} {{status}} by {{customerName}}',
    bodyHtml:
      '<p style="margin:0 0 14px;">Customer <strong>{{customerName}}</strong> has marked quotation <strong>{{quoteRef}}</strong> as <strong>{{status}}</strong>.</p><p style="margin:0;">Open Quotations in your admin dashboard to convert accepted quotes into orders or follow up.</p>',
    triggerEvent: 'quotation.responded',
    isActive: true,
  },
];

export async function ensureDefaultEmailTemplates() {
  const existing = await db.select().from(emailTemplates);
  const existingEvents = new Set(existing.map((e) => e.triggerEvent));
  const missing = DEFAULT_EMAIL_TEMPLATES.filter((t) => !existingEvents.has(t.triggerEvent));
  if (missing.length > 0) {
    for (const tmpl of missing) {
      await db
        .insert(emailTemplates)
        .values(tmpl)
        .onConflictDoNothing({ target: emailTemplates.slug });
    }
  }
}

export async function getAllSettings(): Promise<PlatformSettingsBundle> {
  const rows = await db.select().from(settings);
  const map: Record<string, any> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    general: map.general || {},
    commerce: map.commerce || { operatingMode: 'ecommerce' },
    catalogue: map.catalogue || {},
    email: { ...DEFAULT_EMAIL_SETTINGS, ...(map.email || {}) },
    seo: map.seo || {},
    invoice: { ...DEFAULT_INVOICE_SETTINGS, ...(map.invoice || {}) },
  };
}

/**
 * Resolves effective visibility flags using precedence:
 * Product explicit override ('show'/'hide'/'enable'/'disable') -> Primary Category override -> Global setting
 */
export function resolveEffectiveProductFlags(
  product: typeof products.$inferSelect,
  productCats: Array<typeof categories.$inferSelect>,
  allSettings: PlatformSettingsBundle
) {
  const isCatalogue = allSettings.commerce?.operatingMode === 'catalogue';
  const globalShowPrices = isCatalogue
    ? allSettings.catalogue?.showPricesInCatalogue ?? false
    : allSettings.commerce?.showPrices ?? true;
  const globalShowSalePrices = allSettings.commerce?.showSalePrices ?? true;
  const globalShowStock = isCatalogue
    ? allSettings.catalogue?.showStockInCatalogue ?? true
    : allSettings.commerce?.showStock ?? true;
  const globalShowSku = isCatalogue
    ? allSettings.catalogue?.showSkusInCatalogue ?? true
    : allSettings.commerce?.showSkus ?? true;
  const globalEnableInquiries = allSettings.catalogue?.enableInquiries ?? true;
  const globalEnableQuantity = allSettings.catalogue?.enableQuantitySelection ?? true;
  const globalEnableQuotations = allSettings.catalogue?.enableQuotations ?? true;

  const primaryCat = productCats[0];

  const resolveVis = (prodVal: string, catVal: string | undefined, globalVal: boolean) => {
    if (prodVal === 'show' || prodVal === 'enable') return true;
    if (prodVal === 'hide' || prodVal === 'disable') return false;
    if (catVal === 'show' || catVal === 'enable') return true;
    if (catVal === 'hide' || catVal === 'disable') return false;
    return globalVal;
  };

  return {
    operatingMode: (allSettings.commerce?.operatingMode || 'ecommerce') as 'ecommerce' | 'catalogue',
    showPrices: resolveVis(product.priceVisibility, primaryCat?.priceVisibility, globalShowPrices),
    showSalePrices: resolveVis(product.salePriceVisibility, undefined, globalShowSalePrices),
    showStock: resolveVis(product.stockVisibility, primaryCat?.stockVisibility, globalShowStock),
    showSku: resolveVis(product.skuVisibility, undefined, globalShowSku),
    enableInquiries: resolveVis(
      product.inquiryEnabled,
      primaryCat?.inquiryEnabled,
      globalEnableInquiries
    ),
    enableQuantity: resolveVis(product.quantityEnabled, undefined, globalEnableQuantity),
    enableQuotations: resolveVis(product.quoteEnabled, undefined, globalEnableQuotations),
  };
}

export function getEffectivePrice(
  regularPrice: number,
  salePrice: number | null | undefined,
  saleStart?: Date | null,
  saleEnd?: Date | null
): { unitPrice: number; isOnSale: boolean; regularPrice: number; salePrice: number | null } {
  const now = new Date();
  let saleValid = salePrice !== null && salePrice !== undefined && salePrice < regularPrice;
  if (saleValid && saleStart && now < new Date(saleStart)) saleValid = false;
  if (saleValid && saleEnd && now > new Date(saleEnd)) saleValid = false;
  return {
    unitPrice: saleValid ? roundMoney(salePrice!) : roundMoney(regularPrice),
    isOnSale: saleValid,
    regularPrice: roundMoney(regularPrice),
    salePrice: saleValid ? roundMoney(salePrice!) : null,
  };
}

export async function validateAndCalculateCoupon(
  code: string,
  subtotal: number,
  customerEmail: string,
  items: Array<{ productId: number; categoryIds: number[]; lineTotal: number }>
): Promise<{
  valid: boolean;
  error?: string;
  coupon?: typeof coupons.$inferSelect;
  discountAmount: number;
  freeShipping: boolean;
}> {
  if (!code || !code.trim()) {
    return { valid: false, error: 'Please enter a coupon code.', discountAmount: 0, freeShipping: false };
  }
  const normalizedCode = code.trim().toUpperCase();
  const rows = await db.select().from(coupons).where(eq(coupons.code, normalizedCode)).limit(1);
  if (rows.length === 0) {
    return { valid: false, error: 'Coupon code not found.', discountAmount: 0, freeShipping: false };
  }
  const coupon = rows[0];
  if (!coupon.isActive) {
    return { valid: false, error: 'This coupon is currently inactive.', discountAmount: 0, freeShipping: false };
  }
  const now = new Date();
  if (coupon.startDate && now < new Date(coupon.startDate)) {
    return { valid: false, error: 'This coupon is not active yet.', discountAmount: 0, freeShipping: false };
  }
  if (coupon.expirationDate && now > new Date(coupon.expirationDate)) {
    return { valid: false, error: 'This coupon has expired.', discountAmount: 0, freeShipping: false };
  }
  if (coupon.maxUsage !== null && coupon.maxUsage !== undefined && coupon.usageCount >= coupon.maxUsage) {
    return { valid: false, error: 'This coupon has reached its maximum usage limit.', discountAmount: 0, freeShipping: false };
  }
  if (
    coupon.usageLimitPerCustomer !== null &&
    coupon.usageLimitPerCustomer !== undefined &&
    customerEmail
  ) {
    const usages = await db
      .select()
      .from(couponUsage)
      .where(
        and(eq(couponUsage.couponId, coupon.id), eq(couponUsage.customerEmail, customerEmail.toLowerCase()))
      );
    if (usages.length >= coupon.usageLimitPerCustomer) {
      return {
        valid: false,
        error: 'You have reached the usage limit for this coupon.',
        discountAmount: 0,
        freeShipping: false,
      };
    }
  }
  if (coupon.minPurchaseAmount && subtotal < coupon.minPurchaseAmount) {
    return {
      valid: false,
      error: `Minimum purchase of $${coupon.minPurchaseAmount.toFixed(2)} required.`,
      discountAmount: 0,
      freeShipping: false,
    };
  }

  // Filter eligible items
  const appProds = coupon.applicableProductIds || [];
  const appCats = coupon.applicableCategoryIds || [];
  const excProds = coupon.excludedProductIds || [];
  const excCats = coupon.excludedCategoryIds || [];

  let eligibleSubtotal = 0;
  for (const item of items) {
    if (excProds.includes(item.productId)) continue;
    if (item.categoryIds.some((c) => excCats.includes(c))) continue;
    if (appProds.length > 0 || appCats.length > 0) {
      const matchProd = appProds.includes(item.productId);
      const matchCat = item.categoryIds.some((c) => appCats.includes(c));
      if (!matchProd && !matchCat) continue;
    }
    eligibleSubtotal += item.lineTotal;
  }

  if (eligibleSubtotal <= 0) {
    return {
      valid: false,
      error: 'This coupon does not apply to the items in your cart.',
      discountAmount: 0,
      freeShipping: false,
    };
  }

  if (coupon.discountType === 'free_shipping') {
    return { valid: true, coupon, discountAmount: 0, freeShipping: true };
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = roundMoney((eligibleSubtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
      discount = roundMoney(coupon.maxDiscountAmount);
    }
  } else {
    discount = roundMoney(Math.min(coupon.discountValue, eligibleSubtotal));
  }

  return { valid: true, coupon, discountAmount: discount, freeShipping: false };
}

const COUNTRY_ALIAS_GROUPS: string[][] = [
  ['us', 'usa', 'united states', 'united states of america'],
  ['ca', 'can', 'canada'],
  ['cy', 'cyp', 'cyprus'],
  ['de', 'deu', 'germany'],
  ['fr', 'fra', 'france'],
  ['gb', 'uk', 'united kingdom', 'great britain'],
  ['gr', 'grc', 'greece'],
  ['it', 'ita', 'italy'],
  ['es', 'esp', 'spain'],
  ['nl', 'nld', 'netherlands', 'the netherlands'],
];

const COUNTRY_DISPLAY_LABELS: Record<string, string> = {
  us: 'United States',
  usa: 'United States',
  'united states': 'United States',
  ca: 'Canada',
  can: 'Canada',
  canada: 'Canada',
  cy: 'Cyprus',
  cyp: 'Cyprus',
  cyprus: 'Cyprus',
  de: 'Germany',
  deu: 'Germany',
  germany: 'Germany',
  fr: 'France',
  fra: 'France',
  france: 'France',
  gb: 'United Kingdom',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  gr: 'Greece',
  grc: 'Greece',
  greece: 'Greece',
  it: 'Italy',
  ita: 'Italy',
  italy: 'Italy',
  es: 'Spain',
  esp: 'Spain',
  spain: 'Spain',
  nl: 'Netherlands',
  nld: 'Netherlands',
  netherlands: 'Netherlands',
};

function expandCountryMatch(input: string): Set<string> {
  const norm = input.trim().toLowerCase();
  const set = new Set<string>([norm]);
  for (const group of COUNTRY_ALIAS_GROUPS) {
    if (group.includes(norm)) {
      for (const alias of group) set.add(alias);
    }
  }
  return set;
}

export function extractConfiguredShippingCountries(
  methods: Array<{ countries?: string[] | null }>,
  zones: Array<{ countries?: string[] | null }> = []
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const addCountry = (raw: string) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (lower === '*' || lower === 'all' || lower === 'worldwide') return;
    const canonical = COUNTRY_DISPLAY_LABELS[lower] || trimmed;
    const key = canonical.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(canonical);
    }
  };
  for (const m of methods) {
    for (const c of m.countries || []) addCountry(c);
  }
  for (const z of zones) {
    for (const c of z.countries || []) addCountry(c);
  }
  for (const fallback of ['United States', 'Canada', 'Cyprus', 'Germany', 'France', 'United Kingdom', 'Greece']) {
    addCountry(fallback);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

export function isShippingMethodEligible(
  method: typeof shippingMethods.$inferSelect,
  country?: string,
  region?: string,
  postalCode?: string,
  city?: string,
  zone?: typeof shippingZones.$inferSelect | null
): boolean {
  if (!method.isActive) return false;

  const rawCountries =
    method.countries && method.countries.length > 0
      ? method.countries
      : zone?.countries || [];
  const countries = rawCountries.map((c) => c.trim().toLowerCase()).filter(Boolean);
  const isWorldwide =
    countries.length === 0 ||
    countries.includes('*') ||
    countries.includes('all') ||
    countries.includes('worldwide');

  if (!isWorldwide) {
    if (!country || !country.trim()) return false;
    const customerAliases = expandCountryMatch(country);
    const matchedCountry = countries.some((c) => customerAliases.has(c));
    if (!matchedCountry) return false;
  }

  const rawRegions =
    method.regions && method.regions.length > 0 ? method.regions : zone?.regions || [];
  const regions = rawRegions.map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (regions.length > 0) {
    const candidates = [region, city].map((v) => (v || '').trim().toLowerCase()).filter(Boolean);
    if (candidates.length === 0) return false;
    const matchedRegion = regions.some((r) =>
      candidates.some((cand) => cand === r || cand.includes(r) || r.includes(cand))
    );
    if (!matchedRegion) return false;
  }

  const rawZips =
    method.postalCodes && method.postalCodes.length > 0
      ? method.postalCodes
      : zone?.postalCodes || [];
  const zips = rawZips.map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (zips.length > 0) {
    if (!postalCode || !postalCode.trim()) return false;
    const normZip = postalCode.trim().toLowerCase();
    const matched = zips.some((z) => normZip.startsWith(z));
    if (!matched) return false;
  }

  return true;
}

export function renderBrandedEmail(params: {
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  emailSettings?: Record<string, any>;
  generalSettings?: Record<string, any>;
  variables: Record<string, string>;
  eventLabel?: string;
  templateKey?: string;
}): { subject: string; html: string } {
  return renderBrandedEmailHtml(params);
}

function isTriggerEnabledBySettings(triggerEvent: string, emailSettings: Record<string, any>): boolean {
  switch (triggerEvent) {
    case 'order.created':
      return emailSettings.notifyCustomerOnOrder !== false;
    case 'order.admin_alert':
      return emailSettings.notifyAdminOnOrder !== false;
    case 'order.updated':
      return emailSettings.notifyCustomerOnOrderUpdate !== false;
    case 'inquiry.created':
      return emailSettings.notifyCustomerOnInquiry !== false;
    case 'inquiry.admin_alert':
      return emailSettings.notifyAdminOnInquiry !== false;
    case 'quotation.sent':
      return emailSettings.notifyCustomerOnQuotation !== false;
    case 'quotation.responded':
      return emailSettings.notifyAdminOnQuotationResponse !== false;
    default:
      return true;
  }
}

export async function dispatchNotification(
  triggerEvent: string,
  recipientEmail: string,
  variables: Record<string, string>,
  relatedEntityType: string,
  relatedEntityId?: number,
  options?: { force?: boolean }
) {
  try {
    await ensureDefaultEmailTemplates();
    const allSettings = await getAllSettings();
    const emailCfg = allSettings.email || {};

    if (!options?.force && !isTriggerEnabledBySettings(triggerEvent, emailCfg)) {
      return null;
    }

    const tmpls = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.triggerEvent, triggerEvent))
      .limit(1);

    if (tmpls.length > 0 && !tmpls[0].isActive && !options?.force) {
      return null;
    }

    const fallbackBody = Object.entries(variables)
      .map(([k, v]) => `<p style="margin:0 0 6px;"><strong>${k}:</strong> ${v}</p>`)
      .join('');

    const rendered = renderBrandedEmail({
      subjectTemplate: tmpls[0]?.subject || `Notification: ${triggerEvent}`,
      bodyHtmlTemplate: tmpls[0]?.bodyHtml || fallbackBody,
      emailSettings: emailCfg,
      generalSettings: allSettings.general,
      variables,
      eventLabel: tmpls[0]?.name || triggerEvent,
      templateKey: triggerEvent,
    });

    const [inserted] = await db
      .insert(notifications)
      .values({
        type: triggerEvent,
        recipientEmail,
        subject: rendered.subject,
        body: rendered.html,
        status: options?.force ? 'test_sent' : 'sent',
        relatedEntityType,
        relatedEntityId: relatedEntityId ?? null,
      })
      .returning();

    return inserted;
  } catch (err) {
    console.error('Notification dispatch failed (non-blocking):', err);
    return null;
  }
}

export async function upsertCustomerFromCheckout(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
  billingAddress?: string;
  shippingAddress?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
  userId?: number | null;
}) {
  const normEmail = data.email.trim().toLowerCase();
  const existing = await db.select().from(customers).where(eq(customers.email, normEmail)).limit(1);
  if (existing.length > 0) {
    const updated = await db
      .update(customers)
      .set({
        firstName: data.firstName || existing[0].firstName,
        lastName: data.lastName || existing[0].lastName,
        phone: data.phone || existing[0].phone,
        companyName: data.companyName || existing[0].companyName,
        billingAddress: data.billingAddress || existing[0].billingAddress,
        shippingAddress: data.shippingAddress || existing[0].shippingAddress,
        city: data.city || existing[0].city,
        stateRegion: data.stateRegion || existing[0].stateRegion,
        postalCode: data.postalCode || existing[0].postalCode,
        country: data.country || existing[0].country,
        userId: data.userId ?? existing[0].userId,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existing[0].id))
      .returning();
    return updated[0];
  }
  const inserted = await db
    .insert(customers)
    .values({
      firstName: data.firstName,
      lastName: data.lastName,
      email: normEmail,
      phone: data.phone || '',
      companyName: data.companyName || '',
      billingAddress: data.billingAddress || '',
      shippingAddress: data.shippingAddress || '',
      city: data.city || '',
      stateRegion: data.stateRegion || '',
      postalCode: data.postalCode || '',
      country: data.country || '',
      userId: data.userId ?? null,
    })
    .returning();
  return inserted[0];
}

export function generateUniqueRef(prefix: string): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const stamp = Date.now().toString().slice(-4);
  return `${prefix}-${new Date().getFullYear()}-${stamp}${num}`;
}

export function generateSecureToken(): string {
  return crypto.randomBytes(20).toString('hex');
}

export async function adjustStockAndLog(params: {
  productId: number;
  variationId?: number | null;
  sku: string;
  delta: number;
  reason: string;
  reference?: string;
}) {
  if (params.variationId) {
    const vRows = await db
      .select()
      .from(productVariations)
      .where(eq(productVariations.id, params.variationId))
      .limit(1);
    if (vRows.length > 0) {
      const prev = vRows[0].stockQuantity;
      const next = Math.max(0, prev + params.delta);
      const nextStatus =
        next > 0 ? 'in_stock' : vRows[0].backorderStatus !== 'no' ? 'on_backorder' : 'out_of_stock';
      await db
        .update(productVariations)
        .set({ stockQuantity: next, stockStatus: nextStatus })
        .where(eq(productVariations.id, params.variationId));
      await db.insert(inventoryLogs).values({
        productId: params.productId,
        variationId: params.variationId,
        sku: params.sku,
        changeAmount: params.delta,
        previousStock: prev,
        newStock: next,
        reason: params.reason,
        reference: params.reference || '',
      });
    }
  } else {
    const pRows = await db
      .select()
      .from(products)
      .where(eq(products.id, params.productId))
      .limit(1);
    if (pRows.length > 0) {
      const prev = pRows[0].stockQuantity;
      const next = Math.max(0, prev + params.delta);
      const nextStatus =
        next > 0 ? 'in_stock' : pRows[0].allowBackorder ? 'on_backorder' : 'out_of_stock';
      await db
        .update(products)
        .set({ stockQuantity: next, stockStatus: nextStatus, updatedAt: new Date() })
        .where(eq(products.id, params.productId));
      await db.insert(inventoryLogs).values({
        productId: params.productId,
        variationId: null,
        sku: params.sku,
        changeAmount: params.delta,
        previousStock: prev,
        newStock: next,
        reason: params.reason,
        reference: params.reference || '',
      });
    }
  }
}

export async function recalculateAndSaveQuotationTotals(quotationId: number) {
  const qRows = await db.select().from(quotations).where(eq(quotations.id, quotationId)).limit(1);
  if (qRows.length === 0) return null;
  const q = qRows[0];
  const items = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, quotationId));

  let subtotal = 0;
  for (const item of items) {
    const lineTotal = roundMoney(Math.max(0, item.unitPrice * item.quantity - item.lineDiscount));
    if (lineTotal !== item.lineTotal) {
      await db
        .update(quotationItems)
        .set({ lineTotal })
        .where(eq(quotationItems.id, item.id));
    }
    subtotal += lineTotal;
  }
  subtotal = roundMoney(subtotal);

  let totalDiscount = 0;
  if (q.discountType === 'percentage') {
    totalDiscount = roundMoney((subtotal * q.discountValue) / 100);
  } else {
    totalDiscount = roundMoney(Math.min(q.discountValue, subtotal));
  }

  const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
  const taxAmount = roundMoney((discountedSubtotal * (q.taxRate || 0)) / 100);
  const grandTotal = roundMoney(
    discountedSubtotal + taxAmount + (q.shippingCost || 0) + (q.additionalFees || 0)
  );

  const [updated] = await db
    .update(quotations)
    .set({
      subtotal,
      totalDiscount,
      taxAmount,
      grandTotal,
      updatedAt: new Date(),
    })
    .where(eq(quotations.id, quotationId))
    .returning();

  return updated;
}

export async function convertQuotationToOrder(quotationId: number, changedBy: string) {
  const qRows = await db.select().from(quotations).where(eq(quotations.id, quotationId)).limit(1);
  if (qRows.length === 0) throw new Error('Quotation not found.');
  const q = qRows[0];
  if (q.convertedOrderId) {
    const existing = await db
      .select()
      .from(orders)
      .where(eq(orders.id, q.convertedOrderId))
      .limit(1);
    if (existing.length > 0) return existing[0];
  }

  const items = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, quotationId));
  if (items.length === 0) throw new Error('Cannot convert an empty quotation.');

  let custAddress = {
    firstName: q.customerName.split(' ')[0] || q.customerName,
    lastName: q.customerName.split(' ').slice(1).join(' ') || '',
    company: q.companyName || '',
    address1: 'Address confirmed via Quotation',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94107',
    country: 'United States',
    phone: q.phone || '',
    email: q.email,
  };

  if (q.customerId) {
    const cRows = await db.select().from(customers).where(eq(customers.id, q.customerId)).limit(1);
    if (cRows.length > 0) {
      const c = cRows[0];
      custAddress = {
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.companyName || q.companyName || '',
        address1: c.shippingAddress || c.billingAddress || 'Address confirmed via Quotation',
        city: c.city || 'San Francisco',
        state: c.stateRegion || 'CA',
        postalCode: c.postalCode || '94107',
        country: c.country || 'United States',
        phone: c.phone || q.phone || '',
        email: c.email,
      };
    }
  }

  const orderNumber = generateUniqueRef('KA');
  const [newOrder] = await db
    .insert(orders)
    .values({
      orderNumber,
      customerId: q.customerId,
      customerEmail: q.email,
      customerName: q.customerName,
      customerPhone: q.phone || '',
      companyName: q.companyName || '',
      billingAddress: custAddress,
      shippingAddress: custAddress,
      shippingMethodName: 'Quoted Freight / Courier',
      shippingCost: roundMoney(q.shippingCost || 0),
      subtotal: roundMoney(q.subtotal),
      discountAmount: roundMoney(q.totalDiscount),
      taxAmount: roundMoney(q.taxAmount),
      totalAmount: roundMoney(q.grandTotal),
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
      orderStatus: 'pending',
      customerNotes: q.customerComments || '',
      internalNotes: `Converted from Quotation ${q.quoteRef}. ${q.notes || ''}`.trim(),
      sourceQuotationId: q.id,
      sourceInquiryId: q.inquiryId,
    })
    .returning();

  for (const item of items) {
    const effectiveUnit =
      item.quantity > 0 ? roundMoney(item.lineTotal / item.quantity) : roundMoney(item.unitPrice);
    await db.insert(orderItems).values({
      orderId: newOrder.id,
      productId: item.productId,
      variationId: item.variationId,
      productName: item.productName,
      productImage: item.productImage || '',
      sku: item.sku,
      variationLabel: item.variationLabel || '',
      unitPrice: effectiveUnit,
      quantity: item.quantity,
      lineTotal: roundMoney(item.lineTotal),
      snapshot: { sourceQuotationRef: q.quoteRef },
    });

    if (item.productId) {
      await adjustStockAndLog({
        productId: item.productId,
        variationId: item.variationId,
        sku: item.sku,
        delta: -item.quantity,
        reason: `Order ${orderNumber} (from Quote ${q.quoteRef})`,
        reference: orderNumber,
      });
    }
  }

  await db.insert(orderHistory).values({
    orderId: newOrder.id,
    orderStatus: 'pending',
    paymentStatus: 'unpaid',
    note: `Order created from accepted quotation ${q.quoteRef} (Cash on Delivery).`,
    changedBy,
  });

  await db
    .update(quotations)
    .set({ convertedOrderId: newOrder.id, status: 'accepted', updatedAt: new Date() })
    .where(eq(quotations.id, q.id));

  if (q.inquiryId) {
    await db
      .update(inquiries)
      .set({ status: 'converted', updatedAt: new Date() })
      .where(eq(inquiries.id, q.inquiryId));
  }

  await dispatchNotification(
    'order.created',
    newOrder.customerEmail,
    {
      customerName: newOrder.customerName,
      orderNumber: newOrder.orderNumber,
      totalAmount: `$${newOrder.totalAmount.toFixed(2)}`,
    },
    'order',
    newOrder.id
  );

  const allSettings = await getAllSettings();
  await dispatchNotification(
    'order.admin_alert',
    allSettings.email?.adminNotificationEmail || 'studio@kansoatelier.com',
    {
      customerName: newOrder.customerName,
      email: newOrder.customerEmail,
      orderNumber: newOrder.orderNumber,
      totalAmount: `$${newOrder.totalAmount.toFixed(2)}`,
    },
    'order',
    newOrder.id
  );

  return newOrder;
}

export async function getProductCategoryIdsMap(productIds: number[]) {
  if (productIds.length === 0) return new Map<number, number[]>();
  const rows = await db
    .select()
    .from(productCategories)
    .where(inArray(productCategories.productId, productIds));
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const list = map.get(r.productId) || [];
    list.push(r.categoryId);
    map.set(r.productId, list);
  }
  return map;
}
