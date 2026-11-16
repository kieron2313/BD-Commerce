import React from 'react';
import {
  InvoiceDesignSettings,
  InvoiceOrderData,
  formatInvoiceAddressLines,
  formatInvoiceNumber,
  renderInvoiceHtml,
  resolveInvoiceSettings,
} from '../utils/invoiceRenderer';

export function printInvoiceDocument(params: {
  order: InvoiceOrderData;
  invoiceSettings?: Partial<InvoiceDesignSettings> | null;
  generalSettings?: Record<string, any> | null;
  currency?: string;
}) {
  const html = renderInvoiceHtml(params);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  };

  window.setTimeout(triggerPrint, 250);
}

interface InvoicePreviewSheetProps {
  order: InvoiceOrderData;
  invoiceSettings?: Partial<InvoiceDesignSettings> | null;
  generalSettings?: Record<string, any> | null;
  currency?: string;
  compact?: boolean;
}

export const InvoicePreviewSheet: React.FC<InvoicePreviewSheetProps> = ({
  order,
  invoiceSettings,
  generalSettings,
  currency,
  compact = false,
}) => {
  const cfg = resolveInvoiceSettings(invoiceSettings, generalSettings);
  const curr = currency || generalSettings?.currencySymbol || '$';
  const invNumber = formatInvoiceNumber(order.orderNumber, cfg.invoiceNumberPrefix);

  const fontClass =
    cfg.fontStyle === 'serif'
      ? 'font-serif'
      : cfg.fontStyle === 'mono'
      ? 'font-mono'
      : 'font-sans';

  const billingLines = formatInvoiceAddressLines(order.billingAddress);
  const shippingLines = formatInvoiceAddressLines(order.shippingAddress);
  const isMinimal = cfg.layoutStyle === 'minimal';
  const isSplit = cfg.layoutStyle === 'split_banner';

  return (
    <div
      className={`overflow-hidden rounded-2xl shadow-[0_14px_40px_rgba(17,24,39,0.08)] ${fontClass}`}
      style={{
        backgroundColor: cfg.paperBgColor,
        border: `1px solid ${cfg.borderColor}`,
        color: cfg.bodyTextColor,
      }}
    >
      {/* Header Banner */}
      {!isMinimal ? (
        <div
          className={compact ? 'p-5 sm:p-6' : 'p-7 sm:p-9'}
          style={{
            backgroundColor: cfg.headerBgColor,
            color: cfg.headerTextColor,
            borderBottom: isSplit ? `4px solid ${cfg.accentColor}` : undefined,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="space-y-1.5 max-w-md">
              {cfg.showLogo && cfg.logoUrl && (
                <img
                  src={cfg.logoUrl}
                  alt={cfg.companyName}
                  className="max-h-11 w-auto object-contain mb-2"
                />
              )}
              <p className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {cfg.companyName}
              </p>
              {cfg.companySubtitle && (
                <p className="text-xs opacity-85">{cfg.companySubtitle}</p>
              )}
              <div className="text-[11px] opacity-80 leading-relaxed pt-1.5 space-y-0.5">
                {cfg.companyAddress && <p>{cfg.companyAddress}</p>}
                <p>
                  {cfg.companyEmail}
                  {cfg.companyPhone ? ` · ${cfg.companyPhone}` : ''}
                </p>
                {cfg.taxIdText && <p>{cfg.taxIdText}</p>}
              </div>
            </div>

            <div className="sm:text-right shrink-0 space-y-1">
              <p className="text-2xl sm:text-3xl font-black tracking-wide uppercase">
                {cfg.documentTitle || 'INVOICE'}
              </p>
              <p className="text-sm font-mono font-bold tracking-tight">{invNumber}</p>
              <div className="text-[11px] opacity-85 space-y-0.5 pt-1">
                <p>Order Ref: {order.orderNumber}</p>
                <p>Issued: {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              {cfg.showPaymentStatusBadge && (
                <p className="text-[11px] font-bold uppercase tracking-wider pt-1.5">
                  Payment: {order.paymentStatus}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={compact ? 'p-5 sm:p-6' : 'p-7 sm:p-9'}
          style={{
            backgroundColor: cfg.headerBgColor,
            color: cfg.headerTextColor,
            borderBottom: `2px solid ${cfg.accentColor}`,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="space-y-1 max-w-md">
              {cfg.showLogo && cfg.logoUrl && (
                <img
                  src={cfg.logoUrl}
                  alt={cfg.companyName}
                  className="max-h-10 w-auto object-contain mb-2"
                />
              )}
              <p className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {cfg.companyName}
              </p>
              {cfg.companySubtitle && (
                <p className="text-xs" style={{ color: cfg.mutedTextColor }}>
                  {cfg.companySubtitle}
                </p>
              )}
              <p className="text-[11px] leading-relaxed pt-1" style={{ color: cfg.mutedTextColor }}>
                {[cfg.companyAddress, cfg.companyEmail, cfg.companyPhone, cfg.taxIdText]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            <div className="sm:text-right shrink-0 space-y-1">
              <p
                className="text-2xl sm:text-3xl font-black tracking-wide uppercase"
                style={{ color: cfg.accentColor }}
              >
                {cfg.documentTitle || 'INVOICE'}
              </p>
              <p className="text-sm font-mono font-bold">{invNumber}</p>
              <p className="text-[11px]" style={{ color: cfg.mutedTextColor }}>
                Order: {order.orderNumber} · {new Date(order.createdAt).toLocaleDateString()}
              </p>
              {cfg.showPaymentStatusBadge && (
                <p
                  className="text-[11px] font-bold uppercase tracking-wider pt-1"
                  style={{ color: cfg.accentColor }}
                >
                  Payment: {order.paymentStatus}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Body Content */}
      <div className={compact ? 'p-5 sm:p-6 space-y-6' : 'p-7 sm:p-9 space-y-7'}>
        {/* Billing, Shipping, Payment Columns */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6"
          style={{ borderBottom: `1px solid ${cfg.borderColor}` }}
        >
          {cfg.showBillingAddress && (
            <div className="space-y-1">
              <p
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: cfg.mutedTextColor }}
              >
                {cfg.billedToLabel || 'Billed To'}
              </p>
              <p className="text-sm font-bold">{order.customerName}</p>
              {order.companyName && (
                <p className="text-xs font-semibold" style={{ color: cfg.accentColor }}>
                  {order.companyName}
                </p>
              )}
              <div className="text-xs leading-relaxed" style={{ color: cfg.mutedTextColor }}>
                {billingLines.slice(order.companyName ? 2 : 1).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                <p>{order.customerEmail}</p>
                {order.customerPhone && <p>{order.customerPhone}</p>}
              </div>
            </div>
          )}

          {cfg.showShippingAddress && (
            <div className="space-y-1">
              <p
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: cfg.mutedTextColor }}
              >
                {cfg.shipToLabel || 'Ship To'}
              </p>
              <div className="text-xs leading-relaxed">
                {shippingLines.length > 0 ? (
                  shippingLines.map((line, i) => <p key={i}>{line}</p>)
                ) : (
                  <p>{order.customerName}</p>
                )}
              </div>
              {order.shippingMethodName && (
                <p className="text-[11px] pt-1" style={{ color: cfg.mutedTextColor }}>
                  Carrier: {order.shippingMethodName}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <p
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: cfg.mutedTextColor }}
            >
              {cfg.paymentMethodLabel || 'Payment Method'}
            </p>
            <p className="text-sm font-bold uppercase">{order.paymentMethod || 'COD'}</p>
            <p className="text-xs" style={{ color: cfg.mutedTextColor }}>
              Order Status:{' '}
              <span className="font-semibold capitalize" style={{ color: cfg.bodyTextColor }}>
                {order.orderStatus}
              </span>
            </p>
            <p className="text-xs" style={{ color: cfg.mutedTextColor }}>
              Payment:{' '}
              <span className="font-semibold capitalize" style={{ color: cfg.accentColor }}>
                {order.paymentStatus}
              </span>
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold tracking-tight">{cfg.itemsHeading}</p>
          <div
            className="overflow-x-auto rounded-xl"
            style={{ border: `1px solid ${cfg.borderColor}` }}
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr
                  style={{
                    backgroundColor: cfg.tableHeaderBgColor,
                    color: cfg.tableHeaderTextColor,
                  }}
                >
                  <th className="py-2.5 px-3.5 font-bold uppercase tracking-wider text-[11px]">
                    Item
                  </th>
                  <th className="py-2.5 px-3.5 font-bold uppercase tracking-wider text-[11px] text-right">
                    Qty
                  </th>
                  <th className="py-2.5 px-3.5 font-bold uppercase tracking-wider text-[11px] text-right">
                    Unit Price
                  </th>
                  <th className="py-2.5 px-3.5 font-bold uppercase tracking-wider text-[11px] text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((it, idx) => (
                  <tr
                    key={it.id ?? idx}
                    style={{
                      borderTop: `1px solid ${cfg.borderColor}`,
                    }}
                  >
                    <td className="py-3 px-3.5 align-top">
                      <p className="font-bold">{it.productName}</p>
                      {cfg.showVariation && it.variationLabel && (
                        <p className="text-[11px] mt-0.5" style={{ color: cfg.mutedTextColor }}>
                          {it.variationLabel}
                        </p>
                      )}
                      {cfg.showSku && it.sku && (
                        <p
                          className="text-[11px] font-mono mt-0.5"
                          style={{ color: cfg.mutedTextColor }}
                        >
                          SKU: {it.sku}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right tabular-nums align-top">
                      {it.quantity}
                    </td>
                    <td className="py-3 px-3.5 text-right tabular-nums align-top">
                      {curr}
                      {Number(it.unitPrice).toFixed(2)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold tabular-nums align-top">
                      {curr}
                      {Number(it.lineTotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-xs tabular-nums">
            <div className="flex justify-between">
              <span style={{ color: cfg.mutedTextColor }}>Subtotal</span>
              <span className="font-semibold">
                {curr}
                {Number(order.subtotal).toFixed(2)}
              </span>
            </div>
            {cfg.showDiscountRow && Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-[#15803D] font-semibold">
                <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                <span>
                  -{curr}
                  {Number(order.discountAmount).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: cfg.mutedTextColor }}>
                Shipping ({order.shippingMethodName || 'Standard'})
              </span>
              <span className="font-semibold">
                {Number(order.shippingCost) === 0
                  ? 'Free'
                  : `${curr}${Number(order.shippingCost).toFixed(2)}`}
              </span>
            </div>
            {cfg.showTaxBreakdown && (
              <div className="flex justify-between">
                <span style={{ color: cfg.mutedTextColor }}>Tax</span>
                <span className="font-semibold">
                  {curr}
                  {Number(order.taxAmount).toFixed(2)}
                </span>
              </div>
            )}
            <div
              className="flex justify-between pt-2.5 text-base font-black"
              style={{
                borderTop: `2px solid ${cfg.accentColor}`,
                color: cfg.accentColor,
              }}
            >
              <span>Total Due</span>
              <span>
                {curr}
                {Number(order.totalAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Terms & Customer Note */}
        {cfg.showNotesSection && (cfg.paymentTermsText || order.customerNotes) && (
          <div
            className="rounded-xl p-4 text-xs leading-relaxed space-y-1.5"
            style={{
              backgroundColor: cfg.tableHeaderBgColor,
              border: `1px solid ${cfg.borderColor}`,
            }}
          >
            {cfg.paymentTermsTitle && (
              <p className="font-bold" style={{ color: cfg.tableHeaderTextColor }}>
                {cfg.paymentTermsTitle}
              </p>
            )}
            {cfg.paymentTermsText && (
              <p style={{ color: cfg.mutedTextColor }}>{cfg.paymentTermsText}</p>
            )}
            {order.customerNotes && (
              <p className="pt-1" style={{ color: cfg.bodyTextColor }}>
                <span className="font-bold">Customer Note:</span> {order.customerNotes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {(cfg.thankYouHeading || cfg.footerNotes) && (
        <div
          className="px-6 py-4 text-center space-y-1 text-[11px]"
          style={{
            borderTop: `1px solid ${cfg.borderColor}`,
            backgroundColor: cfg.tableHeaderBgColor,
            color: cfg.mutedTextColor,
          }}
        >
          {cfg.thankYouHeading && (
            <p className="font-bold text-xs" style={{ color: cfg.bodyTextColor }}>
              {cfg.thankYouHeading}
            </p>
          )}
          {cfg.footerNotes && <p>{cfg.footerNotes}</p>}
        </div>
      )}
    </div>
  );
};
