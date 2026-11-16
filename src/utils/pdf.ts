import { jsPDF } from 'jspdf';
import {
  resolveInvoiceSettings,
  formatInvoiceNumber,
  formatInvoiceAddressLines,
  InvoiceOrderData,
  InvoiceDesignSettings,
} from './invoiceRenderer';

export interface QuotationPdfData {
  quoteRef: string;
  status: string;
  createdAt: string;
  expiresAt?: string | null;
  customerName: string;
  companyName?: string;
  email: string;
  phone?: string;
  notes?: string;
  subtotal: number;
  totalDiscount: number;
  taxRate: number;
  taxAmount: number;
  shippingCost: number;
  additionalFees: number;
  grandTotal: number;
  items: Array<{
    sku: string;
    productName: string;
    variationLabel?: string;
    quantity: number;
    unitPrice: number;
    lineDiscount: number;
    lineTotal: number;
  }>;
  company?: {
    siteName?: string;
    address?: string;
    contactEmail?: string;
    phone?: string;
  };
}

export function downloadQuotationPdf(data: QuotationPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 48;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(24, 24, 27);
  doc.text(data.company?.siteName || 'Kanso Atelier', 48, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 110);
  doc.text(data.company?.address || '480 Brannan St, Suite 210, San Francisco, CA 94107', 48, y + 16);
  doc.text(
    `${data.company?.contactEmail || 'studio@kansoatelier.com'}  |  ${data.company?.phone || '+1 (415) 890-4210'}`,
    48,
    y + 29
  );

  // Right Quote Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(24, 24, 27);
  doc.text(`QUOTATION ${data.quoteRef}`, pageWidth - 48, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 90);
  doc.text(`Status: ${data.status.toUpperCase()}`, pageWidth - 48, y + 16, { align: 'right' });
  doc.text(`Issued: ${new Date(data.createdAt).toLocaleDateString()}`, pageWidth - 48, y + 29, {
    align: 'right',
  });
  if (data.expiresAt) {
    doc.text(`Valid Until: ${new Date(data.expiresAt).toLocaleDateString()}`, pageWidth - 48, y + 42, {
      align: 'right',
    });
  }

  y += 72;
  doc.setDrawColor(220, 220, 220);
  doc.line(48, y, pageWidth - 48, y);
  y += 22;

  // Prepared For
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('Prepared For:', 48, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(data.customerName, 48, y + 15);
  if (data.companyName) {
    doc.text(data.companyName, 48, y + 29);
    doc.text(`${data.email}${data.phone ? '  |  ' + data.phone : ''}`, 48, y + 43);
    y += 66;
  } else {
    doc.text(`${data.email}${data.phone ? '  |  ' + data.phone : ''}`, 48, y + 29);
    y += 54;
  }

  // Table Header
  doc.setFillColor(244, 243, 240);
  doc.rect(48, y, pageWidth - 96, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(24, 24, 27);
  doc.text('SKU', 56, y + 15);
  doc.text('Item & Specification', 140, y + 15);
  doc.text('Qty', 360, y + 15, { align: 'right' });
  doc.text('Unit Price', 425, y + 15, { align: 'right' });
  doc.text('Discount', 480, y + 15, { align: 'right' });
  doc.text('Total', pageWidth - 56, y + 15, { align: 'right' });

  y += 34;
  doc.setFont('helvetica', 'normal');

  for (const item of data.items) {
    if (y > 720) {
      doc.addPage();
      y = 48;
    }
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    doc.text(item.sku.slice(0, 16), 56, y);

    doc.setTextColor(24, 24, 27);
    doc.setFont('helvetica', 'bold');
    doc.text(item.productName.slice(0, 38), 140, y);
    doc.setFont('helvetica', 'normal');
    if (item.variationLabel) {
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 120);
      doc.text(item.variationLabel.slice(0, 44), 140, y + 12);
    }

    doc.setFontSize(9);
    doc.setTextColor(24, 24, 27);
    doc.text(String(item.quantity), 360, y, { align: 'right' });
    doc.text(`$${item.unitPrice.toFixed(2)}`, 425, y, { align: 'right' });
    doc.text(item.lineDiscount > 0 ? `-$${item.lineDiscount.toFixed(2)}` : '-', 480, y, {
      align: 'right',
    });
    doc.text(`$${item.lineTotal.toFixed(2)}`, pageWidth - 56, y, { align: 'right' });

    y += item.variationLabel ? 28 : 20;
    doc.setDrawColor(238, 238, 238);
    doc.line(48, y - 6, pageWidth - 48, y - 6);
  }

  y += 16;
  const labelX = pageWidth - 190;
  const valX = pageWidth - 56;
  const addSummaryRow = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(24, 24, 27);
    doc.text(label, labelX, y);
    doc.text(val, valX, y, { align: 'right' });
    y += bold ? 20 : 15;
  };

  addSummaryRow('Subtotal', `$${data.subtotal.toFixed(2)}`);
  if (data.totalDiscount > 0) addSummaryRow('Overall Discount', `-$${data.totalDiscount.toFixed(2)}`);
  if (data.shippingCost > 0) addSummaryRow('Shipping & Freight', `$${data.shippingCost.toFixed(2)}`);
  if (data.additionalFees > 0) addSummaryRow('Additional Fees', `$${data.additionalFees.toFixed(2)}`);
  if (data.taxAmount > 0) addSummaryRow(`Tax (${data.taxRate}%)`, `$${data.taxAmount.toFixed(2)}`);
  doc.setDrawColor(24, 24, 27);
  doc.line(labelX, y - 6, valX, y - 6);
  y += 6;
  addSummaryRow('Grand Total', `$${data.grandTotal.toFixed(2)}`, true);

  if (data.notes) {
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Terms & Notes:', 48, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 90);
    const lines = doc.splitTextToSize(data.notes, pageWidth - 96);
    doc.text(lines, 48, y + 14);
  }

  doc.save(`${data.quoteRef}.pdf`);
}

function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) return fallback;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return fallback;
  return [r, g, b];
}

export function downloadInvoicePdf(params: {
  order: InvoiceOrderData;
  invoiceSettings?: Partial<InvoiceDesignSettings> | null;
  generalSettings?: Record<string, any> | null;
  currency?: string;
}) {
  const cfg = resolveInvoiceSettings(params.invoiceSettings, params.generalSettings);
  const currency = params.currency || params.generalSettings?.currencySymbol || '$';
  const o = params.order;
  const invNumber = formatInvoiceNumber(o.orderNumber, cfg.invoiceNumberPrefix);

  const fontFamily = cfg.fontStyle === 'serif' ? 'times' : cfg.fontStyle === 'mono' ? 'courier' : 'helvetica';
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const headerBg = hexToRgb(cfg.headerBgColor, [115, 73, 38]);
  const headerText = hexToRgb(cfg.headerTextColor, [255, 255, 255]);
  const accent = hexToRgb(cfg.accentColor, [139, 93, 54]);
  const tableBg = hexToRgb(cfg.tableHeaderBgColor, [248, 243, 236]);
  const tableText = hexToRgb(cfg.tableHeaderTextColor, [74, 50, 31]);
  const border = hexToRgb(cfg.borderColor, [232, 223, 211]);
  const body = hexToRgb(cfg.bodyTextColor, [17, 24, 39]);
  const muted = hexToRgb(cfg.mutedTextColor, [107, 114, 128]);

  // Header Banner or Minimal Rule
  const isBanner = cfg.layoutStyle !== 'minimal';
  let y = 0;
  if (isBanner) {
    doc.setFillColor(...headerBg);
    doc.rect(0, 0, pageWidth, 116, 'F');
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(19);
    doc.setTextColor(...headerText);
    doc.text(cfg.companyName || 'Kanso Atelier', 44, 42);

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    if (cfg.companySubtitle) doc.text(cfg.companySubtitle, 44, 58);
    doc.text(cfg.companyAddress || '', 44, 73);
    doc.text(
      `${cfg.companyEmail}${cfg.companyPhone ? `  |  ${cfg.companyPhone}` : ''}${
        cfg.taxIdText ? `  |  ${cfg.taxIdText}` : ''
      }`,
      44,
      86
    );

    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(20);
    doc.text(cfg.documentTitle || 'INVOICE', pageWidth - 44, 44, { align: 'right' });
    doc.setFontSize(11);
    doc.text(invNumber, pageWidth - 44, 62, { align: 'right' });
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.text(`Order Ref: ${o.orderNumber}`, pageWidth - 44, 77, { align: 'right' });
    doc.text(`Issued: ${new Date(o.createdAt).toLocaleDateString()}`, pageWidth - 44, 90, {
      align: 'right',
    });
    if (cfg.showPaymentStatusBadge) {
      doc.setFont(fontFamily, 'bold');
      doc.text(`PAYMENT: ${String(o.paymentStatus || 'unpaid').toUpperCase()}`, pageWidth - 44, 103, {
        align: 'right',
      });
    }
    y = 144;
  } else {
    y = 44;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...body);
    doc.text(cfg.companyName || 'Kanso Atelier', 44, y);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(cfg.companyAddress || '', 44, y + 15);
    doc.text(
      `${cfg.companyEmail}${cfg.taxIdText ? `  |  ${cfg.taxIdText}` : ''}`,
      44,
      y + 27
    );

    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(19);
    doc.setTextColor(...accent);
    doc.text(cfg.documentTitle || 'INVOICE', pageWidth - 44, y, { align: 'right' });
    doc.setFontSize(10.5);
    doc.setTextColor(...body);
    doc.text(invNumber, pageWidth - 44, y + 17, { align: 'right' });
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(`Order ${o.orderNumber} · ${new Date(o.createdAt).toLocaleDateString()}`, pageWidth - 44, y + 30, {
      align: 'right',
    });

    y += 46;
    doc.setDrawColor(...accent);
    doc.setLineWidth(1.4);
    doc.line(44, y, pageWidth - 44, y);
    doc.setLineWidth(0.5);
    y += 22;
  }

  // Addresses & Meta Columns
  const startColsY = y;
  let maxColBottom = y;

  if (cfg.showBillingAddress) {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text((cfg.billedToLabel || 'BILLED TO').toUpperCase(), 44, startColsY);
    let cy = startColsY + 14;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...body);
    doc.text(o.customerName, 44, cy);
    cy += 13;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    const lines = [
      ...formatInvoiceAddressLines(o.billingAddress).slice(1),
      o.customerEmail,
      o.customerPhone || '',
    ].filter(Boolean);
    for (const line of lines.slice(0, 5)) {
      doc.text(line, 44, cy);
      cy += 12;
    }
    maxColBottom = Math.max(maxColBottom, cy);
  }

  if (cfg.showShippingAddress) {
    const colX = 225;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text((cfg.shipToLabel || 'SHIP TO').toUpperCase(), colX, startColsY);
    let cy = startColsY + 14;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...body);
    const lines = formatInvoiceAddressLines(o.shippingAddress);
    for (const line of lines.slice(0, 5)) {
      doc.text(line, colX, cy);
      cy += 12;
    }
    if (o.shippingMethodName) {
      doc.setTextColor(...muted);
      doc.text(`Carrier: ${o.shippingMethodName}`, colX, cy);
      cy += 12;
    }
    maxColBottom = Math.max(maxColBottom, cy);
  }

  {
    const colX = 415;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text((cfg.paymentMethodLabel || 'PAYMENT METHOD').toUpperCase(), colX, startColsY);
    let cy = startColsY + 14;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...body);
    doc.text(String(o.paymentMethod || 'COD').toUpperCase(), colX, cy);
    cy += 14;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(`Order Status: ${o.orderStatus}`, colX, cy);
    cy += 12;
    doc.setTextColor(...accent);
    doc.text(`Payment: ${o.paymentStatus}`, colX, cy);
    maxColBottom = Math.max(maxColBottom, cy + 12);
  }

  y = maxColBottom + 14;
  doc.setDrawColor(...border);
  doc.line(44, y, pageWidth - 44, y);
  y += 20;

  // Items Section Heading
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...body);
  doc.text(cfg.itemsHeading || 'Order Items & Specifications', 44, y);
  y += 10;

  // Table Header
  doc.setFillColor(...tableBg);
  doc.rect(44, y, pageWidth - 88, 24, 'F');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...tableText);
  doc.text('ITEM', 54, y + 15);
  doc.text('QTY', 360, y + 15, { align: 'right' });
  doc.text('UNIT PRICE', 445, y + 15, { align: 'right' });
  doc.text('TOTAL', pageWidth - 54, y + 15, { align: 'right' });
  y += 36;

  for (const it of o.items || []) {
    if (y > pageHeight - 160) {
      doc.addPage();
      y = 48;
    }
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...body);
    doc.text(String(it.productName || '').slice(0, 46), 54, y);

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.text(String(it.quantity), 360, y, { align: 'right' });
    doc.text(`${currency}${Number(it.unitPrice).toFixed(2)}`, 445, y, { align: 'right' });
    doc.setFont(fontFamily, 'bold');
    doc.text(`${currency}${Number(it.lineTotal).toFixed(2)}`, pageWidth - 54, y, { align: 'right' });

    let rowDrop = 14;
    if (cfg.showVariation && it.variationLabel) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(String(it.variationLabel).slice(0, 56), 54, y + rowDrop);
      rowDrop += 11;
    }
    if (cfg.showSku && it.sku) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      doc.text(`SKU: ${it.sku}`, 54, y + rowDrop);
      rowDrop += 11;
    }

    y += Math.max(18, rowDrop + 4);
    doc.setDrawColor(...border);
    doc.line(44, y - 5, pageWidth - 44, y - 5);
    y += 4;
  }

  // Totals Block
  y += 10;
  const labelX = pageWidth - 210;
  const valX = pageWidth - 54;
  const drawSummary = (label: string, val: string, isTotal = false) => {
    doc.setFont(fontFamily, isTotal ? 'bold' : 'normal');
    doc.setFontSize(isTotal ? 11.5 : 9);
    doc.setTextColor(...(isTotal ? accent : body));
    doc.text(label, labelX, y);
    doc.text(val, valX, y, { align: 'right' });
    y += isTotal ? 20 : 16;
  };

  drawSummary('Subtotal', `${currency}${Number(o.subtotal).toFixed(2)}`);
  if (cfg.showDiscountRow && Number(o.discountAmount) > 0) {
    drawSummary(
      `Discount${o.couponCode ? ` (${o.couponCode})` : ''}`,
      `-${currency}${Number(o.discountAmount).toFixed(2)}`
    );
  }
  drawSummary(
    `Shipping`,
    Number(o.shippingCost) === 0 ? 'Free' : `${currency}${Number(o.shippingCost).toFixed(2)}`
  );
  if (cfg.showTaxBreakdown) {
    drawSummary('Tax', `${currency}${Number(o.taxAmount).toFixed(2)}`);
  }

  doc.setDrawColor(...accent);
  doc.setLineWidth(1.2);
  doc.line(labelX, y - 6, valX, y - 6);
  doc.setLineWidth(0.5);
  y += 6;
  drawSummary('Total Due', `${currency}${Number(o.totalAmount).toFixed(2)}`, true);

  // Payment Terms & Notes
  if (cfg.showNotesSection && (cfg.paymentTermsText || o.customerNotes)) {
    y += 14;
    doc.setFillColor(...tableBg);
    const termsLines = cfg.paymentTermsText
      ? doc.splitTextToSize(cfg.paymentTermsText, pageWidth - 112)
      : [];
    const noteLines = o.customerNotes
      ? doc.splitTextToSize(`Customer Note: ${o.customerNotes}`, pageWidth - 112)
      : [];
    const boxHeight = 28 + (termsLines.length + noteLines.length) * 11;
    doc.roundedRect(44, y, pageWidth - 88, boxHeight, 6, 6, 'F');
    let ty = y + 18;
    if (cfg.paymentTermsTitle) {
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...tableText);
      doc.text(cfg.paymentTermsTitle, 56, ty);
      ty += 13;
    }
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...muted);
    if (termsLines.length > 0) {
      doc.text(termsLines, 56, ty);
      ty += termsLines.length * 11;
    }
    if (noteLines.length > 0) {
      doc.setTextColor(...body);
      doc.text(noteLines, 56, ty + 2);
    }
    y += boxHeight + 16;
  }

  // Footer
  const footerY = Math.max(y + 12, pageHeight - 54);
  doc.setDrawColor(...border);
  doc.line(44, footerY - 12, pageWidth - 44, footerY - 12);
  if (cfg.thankYouHeading) {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...body);
    doc.text(cfg.thankYouHeading, pageWidth / 2, footerY, { align: 'center' });
  }
  if (cfg.footerNotes) {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    const fLines = doc.splitTextToSize(cfg.footerNotes, pageWidth - 110);
    doc.text(fLines, pageWidth / 2, footerY + 13, { align: 'center' });
  }

  doc.save(`${invNumber}.pdf`);
}

