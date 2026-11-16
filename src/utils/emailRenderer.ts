export const DEFAULT_EMAIL_SETTINGS_BASE = {
  senderName: 'Kanso Atelier Desk',
  senderAddress: 'studio@kansoatelier.com',
  replyToAddress: 'studio@kansoatelier.com',
  adminNotificationEmail: 'studio@kansoatelier.com',
  notifyAdminOnOrder: true,
  notifyCustomerOnOrder: true,
  notifyCustomerOnOrderUpdate: true,
  notifyAdminOnInquiry: true,
  notifyCustomerOnInquiry: true,
  notifyCustomerOnQuotation: true,
  notifyAdminOnQuotationResponse: true,
  logoUrl: '',
  heroBannerUrl: '',
  headerBgColor: '#734926',
  headerTextColor: '#FFFFFF',
  headerAlign: 'left',
  accentColor: '#734926',
  accentBgColor: '#F8F3EC',
  canvasBgColor: '#F5EFE6',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#E8DFD3',
  bodyTextColor: '#1F2937',
  footerBgColor: '#FAF6F0',
  footerTextColor: '#6B7280',
  buttonBgColor: '#8B5D36',
  buttonTextColor: '#FFFFFF',
  buttonRadius: '12px',
  cardBorderRadius: '20px',
  fontStyle: 'sans',
  headerTagline: 'Architectural Home & Office Furniture',
  footerText:
    'Thank you for choosing Kanso Atelier. Reply to this email anytime for order or specification support.',
  showStoreAddress: true,
  showSocialLinks: true,
  templateColors: {} as Record<string, Record<string, string>>,
};

export type EmailColorKey =
  | 'headerBgColor'
  | 'headerTextColor'
  | 'canvasBgColor'
  | 'cardBgColor'
  | 'cardBorderColor'
  | 'bodyTextColor'
  | 'buttonBgColor'
  | 'buttonTextColor'
  | 'accentBgColor'
  | 'accentColor'
  | 'footerBgColor'
  | 'footerTextColor';

export const EMAIL_COLOR_FIELDS: Array<{ key: EmailColorKey; label: string }> = [
  { key: 'headerBgColor', label: 'Header Bg' },
  { key: 'headerTextColor', label: 'Header Text' },
  { key: 'canvasBgColor', label: 'Canvas Bg' },
  { key: 'cardBgColor', label: 'Card Surface' },
  { key: 'bodyTextColor', label: 'Body Text' },
  { key: 'cardBorderColor', label: 'Card Border' },
  { key: 'buttonBgColor', label: 'Button Bg' },
  { key: 'buttonTextColor', label: 'Button Text' },
  { key: 'accentBgColor', label: 'Badge Tint' },
  { key: 'accentColor', label: 'Badge Text' },
  { key: 'footerBgColor', label: 'Footer Bg' },
  { key: 'footerTextColor', label: 'Footer Text' },
];

export const EMAIL_SAMPLE_VARIABLES: Record<string, string> = {
  customerName: 'Elena Vance',
  email: 'elena.vance@nordicarch.co',
  orderNumber: 'KA-2026-1048',
  totalAmount: '$1,280.00',
  orderStatus: 'shipped',
  paymentStatus: 'unpaid',
  inquiryRef: 'INQ-2026-412',
  quoteRef: 'QT-2026-815',
  grandTotal: '$11,838.00',
  status: 'accepted',
  quoteUrl: 'https://kansoatelier.com/quotation/QT-2026-815?token=preview',
};

export function resolveEffectiveEmailSettings(
  emailSettings?: Record<string, any>,
  templateKey?: string
): Record<string, any> {
  const base = { ...DEFAULT_EMAIL_SETTINGS_BASE, ...(emailSettings || {}) };
  if (templateKey && base.templateColors && base.templateColors[templateKey]) {
    return {
      ...base,
      ...base.templateColors[templateKey],
    };
  }
  return base;
}

export function renderBrandedEmailHtml(params: {
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  emailSettings?: Record<string, any>;
  generalSettings?: Record<string, any>;
  variables: Record<string, string>;
  eventLabel?: string;
  templateKey?: string;
}): { subject: string; html: string } {
  const emailCfg = resolveEffectiveEmailSettings(params.emailSettings, params.templateKey);
  const generalCfg = params.generalSettings || {};
  const siteName = generalCfg.siteName || 'Kanso Atelier';
  const mergedVars: Record<string, string> = {
    siteName,
    senderName: emailCfg.senderName || siteName,
    contactEmail: generalCfg.contactEmail || emailCfg.senderAddress || '',
    ...params.variables,
  };

  let subject = params.subjectTemplate || `Notification from ${siteName}`;
  let innerHtml = params.bodyHtmlTemplate || '';
  for (const [k, v] of Object.entries(mergedVars)) {
    const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
    subject = subject.replace(regex, v ?? '');
    innerHtml = innerHtml.replace(regex, v ?? '');
  }

  // Sync CTA button anchors styled via legacy defaults or data-ka-cta attribute with active design tokens
  const btnRadius = emailCfg.buttonRadius || '12px';
  innerHtml = innerHtml.replace(
    /background:\s*#171717\s*;\s*color:\s*#ffffff\s*;/gi,
    `background:${emailCfg.buttonBgColor};color:${emailCfg.buttonTextColor};border-radius:${btnRadius};`
  );
  innerHtml = innerHtml.replace(
    /data-ka-cta="true"\s+style="[^"]*"/gi,
    `data-ka-cta="true" style="display:inline-block;padding:12px 24px;border-radius:${btnRadius};background:${emailCfg.buttonBgColor};color:${emailCfg.buttonTextColor};text-decoration:none;font-weight:700;font-size:14px;"`
  );

  const fontStack =
    emailCfg.fontStyle === 'serif'
      ? "Georgia, 'Times New Roman', serif"
      : "'Proxima Nova','proxima-nova','Montserrat','Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  const align = emailCfg.headerAlign === 'center' ? 'center' : 'left';
  const logoMarkup = emailCfg.logoUrl
    ? `<img src="${emailCfg.logoUrl}" alt="${siteName}" style="max-height:40px;width:auto;margin:${
        align === 'center' ? '0 auto 12px' : '0 0 12px'
      };display:block;" />`
    : '';
  const taglineMarkup = emailCfg.headerTagline
    ? `<p style="margin:5px 0 0;font-size:12px;opacity:0.86;">${emailCfg.headerTagline}</p>`
    : '';
  const heroBannerMarkup = emailCfg.heroBannerUrl
    ? `<tr><td style="padding:0;line-height:0;background:#EDE6DC;"><img src="${emailCfg.heroBannerUrl}" alt="${siteName}" style="width:100%;max-height:220px;object-fit:cover;display:block;" /></td></tr>`
    : '';
  const badgeMarkup = params.eventLabel
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${emailCfg.accentBgColor};color:${emailCfg.accentColor};font-size:11px;font-weight:700;letter-spacing:0.02em;margin-bottom:16px;">${params.eventLabel}</span>`
    : '';
  const footerTextColor = emailCfg.footerTextColor || '#6B7280';
  const bodyTextColor = emailCfg.bodyTextColor || '#1F2937';
  const cardBorderColor = emailCfg.cardBorderColor || '#E8DFD3';
  const addressMarkup =
    emailCfg.showStoreAddress && generalCfg.address
      ? `<p style="margin:8px 0 0;font-size:11px;color:${footerTextColor};opacity:0.85;">${generalCfg.address}${
          generalCfg.phone ? ` · ${generalCfg.phone}` : ''
        }</p>`
      : '';

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:28px 16px;background:${emailCfg.canvasBgColor};font-family:${fontStack};color:${bodyTextColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:${emailCfg.cardBgColor};border-radius:${emailCfg.cardBorderRadius};overflow:hidden;border:1px solid ${cardBorderColor};box-shadow:0 12px 32px rgba(68,42,20,0.08);">
    <tr>
      <td style="padding:26px 30px;background:${emailCfg.headerBgColor};color:${emailCfg.headerTextColor};text-align:${align};">
        ${logoMarkup}
        <h1 style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.02em;">${
          emailCfg.senderName || siteName
        }</h1>
        ${taglineMarkup}
      </td>
    </tr>
    ${heroBannerMarkup}
    <tr>
      <td style="padding:28px 30px;font-size:15px;line-height:1.68;color:${bodyTextColor};">
        ${badgeMarkup}
        <div>${innerHtml}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 30px;background:${emailCfg.footerBgColor || '#FAFAFB'};border-top:1px solid ${cardBorderColor};font-size:12px;line-height:1.55;color:${footerTextColor};text-align:${align};">
        <p style="margin:0;">${emailCfg.footerText || ''}</p>
        ${addressMarkup}
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
