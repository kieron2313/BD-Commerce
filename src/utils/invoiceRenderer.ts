export interface InvoiceDesignSettings {
  presetName: string;
  layoutStyle: 'classic' | 'split_banner' | 'minimal';
  documentTitle: string;
  invoiceNumberPrefix: string;
  companyName: string;
  companySubtitle: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  taxIdText: string;
  logoUrl: string;
  headerBgColor: string;
  headerTextColor: string;
  accentColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  borderColor: string;
  paperBgColor: string;
  bodyTextColor: string;
  mutedTextColor: string;
  fontStyle: 'sans' | 'serif' | 'mono';
  billedToLabel: string;
  shipToLabel: string;
  itemsHeading: string;
  paymentMethodLabel: string;
  paymentTermsTitle: string;
  paymentTermsText: string;
  thankYouHeading: string;
  footerNotes: string;
  showLogo: boolean;
  showSku: boolean;
  showVariation: boolean;
  showBillingAddress: boolean;
  showShippingAddress: boolean;
  showPaymentStatusBadge: boolean;
  showTaxBreakdown: boolean;
  showDiscountRow: boolean;
  showNotesSection: boolean;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceDesignSettings = {
  presetName: 'Sculpted Oak',
  layoutStyle: 'classic',
  documentTitle: 'INVOICE',
  invoiceNumberPrefix: 'INV-',
  companyName: '',
  companySubtitle: 'Architectural Home & Office Furniture',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  taxIdText: 'Tax / VAT ID: KA-94107-STUDIO',
  logoUrl: '',
  headerBgColor: '#734926',
  headerTextColor: '#FFFFFF',
  accentColor: '#8B5D36',
  tableHeaderBgColor: '#F8F3EC',
  tableHeaderTextColor: '#4A321F',
  borderColor: '#E8DFD3',
  paperBgColor: '#FFFFFF',
  bodyTextColor: '#111827',
  mutedTextColor: '#6B7280',
  fontStyle: 'sans',
  billedToLabel: 'Billed To',
  shipToLabel: 'Ship To',
  itemsHeading: 'Order Items & Specifications',
  paymentMethodLabel: 'Payment Method',
  paymentTermsTitle: 'Payment & Fulfillment Terms',
  paymentTermsText:
    'Orders placed via Cash on Delivery are payable in full upon inspected delivery. All custom pieces are crated and insured in transit.',
  thankYouHeading: 'Thank you for furnishing your space with us.',
  footerNotes:
    'For billing inquiries, VAT certificates, or delivery scheduling, please reference your invoice number when contacting our studio desk.',
  showLogo: true,
  showSku: true,
  showVariation: true,
  showBillingAddress: true,
  showShippingAddress: true,
  showPaymentStatusBadge: true,
  showTaxBreakdown: true,
  showDiscountRow: true,
  showNotesSection: true,
};

export const INVOICE_THEME_PRESETS: Array<{
  name: string;
  layoutStyle: 'classic' | 'split_banner' | 'minimal';
  headerBgColor: string;
  headerTextColor: string;
  accentColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  borderColor: string;
  paperBgColor: string;
  bodyTextColor: string;
  mutedTextColor: string;
}> = [
  {
    name: 'Sculpted Oak',
    layoutStyle: 'classic',
    headerBgColor: '#734926',
    headerTextColor: '#FFFFFF',
    accentColor: '#8B5D36',
    tableHeaderBgColor: '#F8F3EC',
    tableHeaderTextColor: '#4A321F',
    borderColor: '#E8DFD3',
    paperBgColor: '#FFFFFF',
    bodyTextColor: '#111827',
    mutedTextColor: '#6B7280',
  },
  {
    name: 'Atelier Charcoal',
    layoutStyle: 'split_banner',
    headerBgColor: '#171717',
    headerTextColor: '#FFFFFF',
    accentColor: '#171717',
    tableHeaderBgColor: '#F3F4F6',
    tableHeaderTextColor: '#111827',
    borderColor: '#E5E7EB',
    paperBgColor: '#FFFFFF',
    bodyTextColor: '#111827',
    mutedTextColor: '#6B7280',
  },
  {
    name: 'Architectural Mint',
    layoutStyle: 'split_banner',
    headerBgColor: '#14532D',
    headerTextColor: '#FFFFFF',
    accentColor: '#15803D',
    tableHeaderBgColor: '#ECFDF5',
    tableHeaderTextColor: '#14532D',
    borderColor: '#D1E7D8',
    paperBgColor: '#FFFFFF',
    bodyTextColor: '#111827',
    mutedTextColor: '#4B5563',
  },
  {
    name: 'Editorial Paper',
    layoutStyle: 'minimal',
    headerBgColor: '#FBF9F6',
    headerTextColor: '#1C1917',
    accentColor: '#78350F',
    tableHeaderBgColor: '#F5F2ED',
    tableHeaderTextColor: '#44403C',
    borderColor: '#E7E0D6',
    paperBgColor: '#FFFFFF',
    bodyTextColor: '#1C1917',
    mutedTextColor: '#78716C',
  },
];

export const INVOICE_COLOR_FIELDS: Array<{
  key: keyof Pick<
    InvoiceDesignSettings,
    | 'headerBgColor'
    | 'headerTextColor'
    | 'accentColor'
    | 'tableHeaderBgColor'
    | 'tableHeaderTextColor'
    | 'borderColor'
    | 'paperBgColor'
    | 'bodyTextColor'
    | 'mutedTextColor'
  >;
  label: string;
}> = [
  { key: 'headerBgColor', label: 'Header Banner Bg' },
  { key: 'headerTextColor', label: 'Header Text' },
  { key: 'accentColor', label: 'Accent & Totals' },
  { key: 'tableHeaderBgColor', label: 'Table Header Bg' },
  { key: 'tableHeaderTextColor', label: 'Table Header Text' },
  { key: 'borderColor', label: 'Border & Dividers' },
  { key: 'paperBgColor', label: 'Paper Surface' },
  { key: 'bodyTextColor', label: 'Primary Text' },
  { key: 'mutedTextColor', label: 'Muted Labels' },
];

export interface InvoiceOrderItemData {
  id?: number;
  productName: string;
  sku: string;
  variationLabel?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  productImage?: string | null;
}

export interface InvoiceOrderData {
  id?: number;
  orderNumber: string;
  createdAt: string | Date;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  companyName?: string | null;
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    email?: string;
  } | null;
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    email?: string;
  } | null;
  shippingMethodName?: string | null;
  shippingCost: number;
  subtotal: number;
  couponCode?: string | null;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod?: string | null;
  paymentStatus: string;
  orderStatus: string;
  customerNotes?: string | null;
  items: InvoiceOrderItemData[];
}

export const SAMPLE_INVOICE_ORDER: InvoiceOrderData = {
  id: 0,
  orderNumber: 'KA-2026-1048',
  createdAt: new Date().toISOString(),
  customerName: 'Elena Vance',
  customerEmail: 'elena.vance@nordicarch.co',
  customerPhone: '+1 (415) 555-0192',
  companyName: 'Nordic Arch Studio',
  billingAddress: {
    firstName: 'Elena',
    lastName: 'Vance',
    company: 'Nordic Arch Studio',
    address1: '742 Evergreen Terrace, Suite 4B',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94107',
    country: 'United States',
  },
  shippingAddress: {
    firstName: 'Elena',
    lastName: 'Vance',
    company: 'Nordic Arch Studio',
    address1: '742 Evergreen Terrace, Suite 4B',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94107',
    country: 'United States',
  },
  shippingMethodName: 'White-Glove Studio Courier',
  shippingCost: 45,
  subtotal: 1480,
  couponCode: 'ATELIER10',
  discountAmount: 148,
  taxAmount: 113.22,
  totalAmount: 1490.22,
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
  orderStatus: 'processing',
  customerNotes: 'Please call 30 minutes prior to freight elevator delivery.',
  items: [
    {
      productName: 'Solid White Oak Lounge Chair',
      sku: 'KA-CHR-204',
      variationLabel: 'Finish: Natural Oil · Bouclé Oat',
      quantity: 1,
      unitPrice: 920,
      lineTotal: 920,
    },
    {
      productName: 'Linear Brass Atelier Pendant',
      sku: 'KA-LMP-118',
      variationLabel: 'Finish: Brushed Brass · 120cm',
      quantity: 2,
      unitPrice: 280,
      lineTotal: 560,
    },
  ],
};

export function resolveInvoiceSettings(
  invoiceSettings?: Partial<InvoiceDesignSettings> | null,
  generalSettings?: Record<string, any> | null
): InvoiceDesignSettings {
  const merged: InvoiceDesignSettings = {
    ...DEFAULT_INVOICE_SETTINGS,
    ...(invoiceSettings || {}),
  };
  return {
    ...merged,
    companyName: merged.companyName?.trim() || generalSettings?.siteName || 'Kanso Atelier',
    companyAddress:
      merged.companyAddress?.trim() ||
      generalSettings?.address ||
      '480 Brannan St, Suite 210, San Francisco, CA 94107',
    companyEmail:
      merged.companyEmail?.trim() || generalSettings?.contactEmail || 'studio@kansoatelier.com',
    companyPhone: merged.companyPhone?.trim() || generalSettings?.phone || '+1 (415) 890-4210',
  };
}

export function formatInvoiceNumber(orderNumber: string, prefix = 'INV-'): string {
  const cleanPrefix = (prefix ?? 'INV-').trim();
  if (!cleanPrefix) return orderNumber;
  if (orderNumber.toUpperCase().startsWith(cleanPrefix.toUpperCase())) return orderNumber;
  return `${cleanPrefix}${orderNumber}`;
}

export function formatInvoiceAddressLines(addr?: InvoiceOrderData['billingAddress']): string[] {
  if (!addr) return [];
  const fullName = [addr.firstName, addr.lastName].filter(Boolean).join(' ').trim();
  const cityStateZip = [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
  return [
    fullName,
    addr.company || '',
    addr.address1 || '',
    addr.address2 || '',
    cityStateZip,
    addr.country || '',
  ].filter(Boolean);
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderInvoiceHtml(params: {
  order: InvoiceOrderData;
  invoiceSettings?: Partial<InvoiceDesignSettings> | null;
  generalSettings?: Record<string, any> | null;
  currency?: string;
}): string {
  const cfg = resolveInvoiceSettings(params.invoiceSettings, params.generalSettings);
  const currency = params.currency || params.generalSettings?.currencySymbol || '$';
  const o = params.order;
  const invNumber = formatInvoiceNumber(o.orderNumber, cfg.invoiceNumberPrefix);
  const fontStack =
    cfg.fontStyle === 'serif'
      ? "Georgia, 'Times New Roman', serif"
      : cfg.fontStyle === 'mono'
      ? "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace"
      : "'Proxima Nova', 'Montserrat', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";

  const billingLines = formatInvoiceAddressLines(o.billingAddress);
  const shippingLines = formatInvoiceAddressLines(o.shippingAddress);

  const itemsRows = (o.items || [])
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid ${cfg.borderColor};vertical-align:top;">
          <div style="font-weight:700;color:${cfg.bodyTextColor};font-size:13px;">${escapeHtml(it.productName)}</div>
          ${
            cfg.showVariation && it.variationLabel
              ? `<div style="font-size:11px;color:${cfg.mutedTextColor};margin-top:2px;">${escapeHtml(it.variationLabel)}</div>`
              : ''
          }
          ${
            cfg.showSku && it.sku
              ? `<div style="font-size:11px;font-family:monospace;color:${cfg.mutedTextColor};margin-top:2px;">SKU: ${escapeHtml(it.sku)}</div>`
              : ''
          }
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid ${cfg.borderColor};text-align:right;font-variant-numeric:tabular-nums;font-size:13px;color:${cfg.bodyTextColor};">${it.quantity}</td>
        <td style="padding:12px 14px;border-bottom:1px solid ${cfg.borderColor};text-align:right;font-variant-numeric:tabular-nums;font-size:13px;color:${cfg.bodyTextColor};">${currency}${Number(it.unitPrice).toFixed(2)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid ${cfg.borderColor};text-align:right;font-variant-numeric:tabular-nums;font-size:13px;font-weight:700;color:${cfg.bodyTextColor};">${currency}${Number(it.lineTotal).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const isBanner = cfg.layoutStyle !== 'minimal';
  const headerHtml = isBanner
    ? `<div style="background:${cfg.headerBgColor};color:${cfg.headerTextColor};padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
        <div>
          ${cfg.showLogo && cfg.logoUrl ? `<img src="${escapeHtml(cfg.logoUrl)}" alt="${escapeHtml(cfg.companyName)}" style="max-height:42px;margin-bottom:10px;display:block;" />` : ''}
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(cfg.companyName)}</div>
          ${cfg.companySubtitle ? `<div style="font-size:12px;opacity:0.86;margin-top:3px;">${escapeHtml(cfg.companySubtitle)}</div>` : ''}
          <div style="font-size:11px;opacity:0.82;margin-top:10px;line-height:1.5;">
            ${escapeHtml(cfg.companyAddress)}<br/>
            ${escapeHtml(cfg.companyEmail)}${cfg.companyPhone ? ` · ${escapeHtml(cfg.companyPhone)}` : ''}
            ${cfg.taxIdText ? `<br/>${escapeHtml(cfg.taxIdText)}` : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:26px;font-weight:900;letter-spacing:0.04em;">${escapeHtml(cfg.documentTitle)}</div>
          <div style="font-size:14px;font-weight:700;font-family:monospace;margin-top:6px;">${escapeHtml(invNumber)}</div>
          <div style="font-size:11px;opacity:0.86;margin-top:8px;line-height:1.6;">
            Order Ref: ${escapeHtml(o.orderNumber)}<br/>
            Issued: ${new Date(o.createdAt).toLocaleDateString()}
          </div>
          ${
            cfg.showPaymentStatusBadge
              ? `<div style="margin-top:10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Payment: ${escapeHtml(o.paymentStatus)}</div>`
              : ''
          }
        </div>
      </div>`
    : `<div style="padding:28px 32px 20px;border-bottom:2px solid ${cfg.accentColor};background:${cfg.headerBgColor};color:${cfg.headerTextColor};display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
        <div>
          ${cfg.showLogo && cfg.logoUrl ? `<img src="${escapeHtml(cfg.logoUrl)}" alt="${escapeHtml(cfg.companyName)}" style="max-height:40px;margin-bottom:8px;display:block;" />` : ''}
          <div style="font-size:22px;font-weight:800;">${escapeHtml(cfg.companyName)}</div>
          <div style="font-size:11px;color:${cfg.mutedTextColor};margin-top:4px;line-height:1.5;">
            ${escapeHtml(cfg.companyAddress)} · ${escapeHtml(cfg.companyEmail)}${cfg.taxIdText ? ` · ${escapeHtml(cfg.taxIdText)}` : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:24px;font-weight:900;color:${cfg.accentColor};">${escapeHtml(cfg.documentTitle)}</div>
          <div style="font-size:13px;font-family:monospace;font-weight:700;margin-top:4px;">${escapeHtml(invNumber)}</div>
          <div style="font-size:11px;color:${cfg.mutedTextColor};margin-top:4px;">Order: ${escapeHtml(o.orderNumber)} · ${new Date(o.createdAt).toLocaleDateString()}</div>
        </div>
      </div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(cfg.documentTitle)} ${escapeHtml(invNumber)}</title>
</head>
<body style="margin:0;padding:24px;background:#F3F4F6;font-family:${fontStack};color:${cfg.bodyTextColor};">
  <div style="max-width:780px;margin:0 auto;background:${cfg.paperBgColor};border:1px solid ${cfg.borderColor};border-radius:16px;overflow:hidden;">
    ${headerHtml}
    <div style="padding:28px 32px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;padding-bottom:22px;border-bottom:1px solid ${cfg.borderColor};">
        ${
          cfg.showBillingAddress
            ? `<div>
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${cfg.mutedTextColor};margin-bottom:6px;">${escapeHtml(cfg.billedToLabel)}</div>
                <div style="font-size:13px;font-weight:700;">${escapeHtml(o.customerName)}</div>
                ${o.companyName ? `<div style="font-size:12px;font-weight:600;color:${cfg.accentColor};">${escapeHtml(o.companyName)}</div>` : ''}
                <div style="font-size:12px;color:${cfg.mutedTextColor};line-height:1.5;margin-top:3px;">
                  ${billingLines.slice(o.companyName ? 2 : 1).map(escapeHtml).join('<br/>')}
                  <br/>${escapeHtml(o.customerEmail)}${o.customerPhone ? ` · ${escapeHtml(o.customerPhone)}` : ''}
                </div>
              </div>`
            : ''
        }
        ${
          cfg.showShippingAddress
            ? `<div>
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${cfg.mutedTextColor};margin-bottom:6px;">${escapeHtml(cfg.shipToLabel)}</div>
                <div style="font-size:12px;color:${cfg.bodyTextColor};line-height:1.5;">
                  ${shippingLines.map(escapeHtml).join('<br/>') || escapeHtml(o.customerName)}
                </div>
                ${o.shippingMethodName ? `<div style="font-size:11px;color:${cfg.mutedTextColor};margin-top:6px;">Carrier: ${escapeHtml(o.shippingMethodName)}</div>` : ''}
              </div>`
            : ''
        }
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${cfg.mutedTextColor};margin-bottom:6px;">${escapeHtml(cfg.paymentMethodLabel)}</div>
          <div style="font-size:13px;font-weight:700;text-transform:uppercase;">${escapeHtml(o.paymentMethod || 'COD')}</div>
          <div style="font-size:12px;color:${cfg.mutedTextColor};margin-top:4px;">Order Status: <strong style="color:${cfg.bodyTextColor};text-transform:capitalize;">${escapeHtml(o.orderStatus)}</strong></div>
          <div style="font-size:12px;color:${cfg.mutedTextColor};margin-top:2px;">Payment Status: <strong style="color:${cfg.accentColor};text-transform:capitalize;">${escapeHtml(o.paymentStatus)}</strong></div>
        </div>
      </div>

      <div style="margin-top:24px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px;">${escapeHtml(cfg.itemsHeading)}</div>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid ${cfg.borderColor};border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:${cfg.tableHeaderBgColor};color:${cfg.tableHeaderTextColor};text-align:left;">
              <th style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Item</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-align:right;">Qty</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-align:right;">Unit Price</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:22px;">
        <table cellspacing="0" cellpadding="0" style="min-width:260px;font-size:13px;font-variant-numeric:tabular-nums;">
          <tr>
            <td style="padding:5px 0;color:${cfg.mutedTextColor};">Subtotal</td>
            <td style="padding:5px 0;text-align:right;font-weight:600;">${currency}${Number(o.subtotal).toFixed(2)}</td>
          </tr>
          ${
            cfg.showDiscountRow && Number(o.discountAmount) > 0
              ? `<tr><td style="padding:5px 0;color:#15803D;">Discount${o.couponCode ? ` (${escapeHtml(o.couponCode)})` : ''}</td><td style="padding:5px 0;text-align:right;color:#15803D;font-weight:600;">-${currency}${Number(o.discountAmount).toFixed(2)}</td></tr>`
              : ''
          }
          <tr>
            <td style="padding:5px 0;color:${cfg.mutedTextColor};">Shipping (${escapeHtml(o.shippingMethodName || 'Standard')})</td>
            <td style="padding:5px 0;text-align:right;font-weight:600;">${Number(o.shippingCost) === 0 ? 'Free' : `${currency}${Number(o.shippingCost).toFixed(2)}`}</td>
          </tr>
          ${
            cfg.showTaxBreakdown
              ? `<tr><td style="padding:5px 0;color:${cfg.mutedTextColor};">Tax</td><td style="padding:5px 0;text-align:right;font-weight:600;">${currency}${Number(o.taxAmount).toFixed(2)}</td></tr>`
              : ''
          }
          <tr>
            <td style="padding:12px 0 0;border-top:2px solid ${cfg.accentColor};font-size:15px;font-weight:800;color:${cfg.accentColor};">Total Due</td>
            <td style="padding:12px 0 0;border-top:2px solid ${cfg.accentColor};text-align:right;font-size:16px;font-weight:900;color:${cfg.accentColor};">${currency}${Number(o.totalAmount).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${
        cfg.showNotesSection && (cfg.paymentTermsText || o.customerNotes)
          ? `<div style="margin-top:26px;padding:16px 18px;background:${cfg.tableHeaderBgColor};border:1px solid ${cfg.borderColor};border-radius:12px;font-size:12px;line-height:1.6;">
              ${cfg.paymentTermsTitle ? `<div style="font-weight:700;color:${cfg.tableHeaderTextColor};margin-bottom:4px;">${escapeHtml(cfg.paymentTermsTitle)}</div>` : ''}
              ${cfg.paymentTermsText ? `<div style="color:${cfg.mutedTextColor};">${escapeHtml(cfg.paymentTermsText)}</div>` : ''}
              ${o.customerNotes ? `<div style="margin-top:8px;color:${cfg.bodyTextColor};"><strong>Customer Note:</strong> ${escapeHtml(o.customerNotes)}</div>` : ''}
            </div>`
          : ''
      }
    </div>
    <div style="padding:18px 32px;border-top:1px solid ${cfg.borderColor};background:${cfg.tableHeaderBgColor};font-size:11px;color:${cfg.mutedTextColor};text-align:center;">
      ${cfg.thankYouHeading ? `<div style="font-weight:700;color:${cfg.bodyTextColor};font-size:12px;margin-bottom:3px;">${escapeHtml(cfg.thankYouHeading)}</div>` : ''}
      ${cfg.footerNotes ? `<div>${escapeHtml(cfg.footerNotes)}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}
