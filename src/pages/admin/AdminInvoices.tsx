import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  Maximize2,
  Palette,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  Search,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import {
  DEFAULT_INVOICE_SETTINGS,
  INVOICE_COLOR_FIELDS,
  INVOICE_THEME_PRESETS,
  InvoiceDesignSettings,
  InvoiceOrderData,
  SAMPLE_INVOICE_ORDER,
  formatInvoiceNumber,
} from '../../utils/invoiceRenderer';
import { downloadInvoicePdf } from '../../utils/pdf';
import { InvoicePreviewSheet, printInvoiceDocument } from '../../components/InvoicePreviewSheet';

export type AdminInvoicesTab = 'all' | 'customize';

export const AdminInvoices: React.FC = () => {
  const { authFetch, settings, refreshBootstrap } = usePlatform();
  const currency = settings.general?.currencySymbol || '$';

  const [activeTab, setActiveTab] = useState<AdminInvoicesTab>('all');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const [designDraft, setDesignDraft] = useState<InvoiceDesignSettings>(() => ({
    ...DEFAULT_INVOICE_SETTINGS,
    ...(settings.invoice || {}),
  }));

  const [previewOrderModal, setPreviewOrderModal] = useState<InvoiceOrderData | null>(null);
  const [studioSampleId, setStudioSampleId] = useState<string>('sample');
  const [studioFullscreen, setStudioFullscreen] = useState(false);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const [invRes, mediaRes] = await Promise.all([
        authFetch('/api/admin/invoices'),
        authFetch('/api/admin/media'),
      ]);
      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data.invoices || []);
        if (data.invoiceSettings) {
          setDesignDraft({
            ...DEFAULT_INVOICE_SETTINGS,
            ...data.invoiceSettings,
          });
        }
      }
      if (mediaRes.ok) {
        const mData = await mediaRes.json();
        setMediaAssets(mData.media || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (paymentFilter && inv.paymentStatus !== paymentFilter) return false;
      if (!q) return true;
      const computedInvNum = formatInvoiceNumber(
        inv.orderNumber,
        designDraft.invoiceNumberPrefix
      ).toLowerCase();
      return (
        computedInvNum.includes(q) ||
        String(inv.orderNumber || '').toLowerCase().includes(q) ||
        String(inv.customerName || '').toLowerCase().includes(q) ||
        String(inv.customerEmail || '').toLowerCase().includes(q)
      );
    });
  }, [invoices, search, paymentFilter, designDraft.invoiceNumberPrefix]);

  const metrics = useMemo(() => {
    const totalCount = invoices.length;
    const paidCount = invoices.filter((i) => i.paymentStatus === 'paid').length;
    const unpaidCount = invoices.filter((i) => i.paymentStatus === 'unpaid').length;
    const totalRevenue = invoices.reduce((acc, i) => acc + Number(i.totalAmount || 0), 0);
    return { totalCount, paidCount, unpaidCount, totalRevenue };
  }, [invoices]);

  const studioPreviewOrder: InvoiceOrderData = useMemo(() => {
    if (studioSampleId !== 'sample') {
      const found = invoices.find((i) => String(i.id) === studioSampleId);
      if (found) return found;
    }
    return SAMPLE_INVOICE_ORDER;
  }, [studioSampleId, invoices]);

  const handleSaveDesign = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await authFetch('/api/admin/settings/invoice', {
        method: 'PUT',
        body: JSON.stringify(designDraft),
      });
      if (res.ok) {
        await refreshBootstrap();
        setMsg('Invoice visual design & text saved across Admin and Customer Portal.');
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg(err.error || 'Failed to save invoice settings.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetDesign = () => {
    setDesignDraft({ ...DEFAULT_INVOICE_SETTINGS });
    setMsg('Restored default invoice settings in editor. Click Save Invoice Design to apply.');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'branding');
      const res = await authFetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const uploaded = await res.json();
        const url = uploaded.asset?.url || uploaded.url;
        if (url) {
          setDesignDraft((prev) => ({ ...prev, logoUrl: url, showLogo: true }));
          setMsg('Logo uploaded and applied to preview.');
        }
        await loadInvoices();
      } else {
        setMsg('Logo upload failed.');
      }
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSendInvoiceEmail = async (orderId: number, email: string) => {
    setSendingId(orderId);
    setMsg('');
    try {
      const res = await authFetch(`/api/admin/invoices/${orderId}/send`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Invoice ${data.invoiceNumber || ''} recorded as sent to ${email}.`);
      } else {
        setMsg(data.error || 'Failed to send invoice email.');
      }
    } finally {
      setSendingId(null);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717] text-[#111827]';

  return (
    <div className="space-y-6">
      {/* Top Studio Header & Tabs */}
      <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-[#111827]">
            Invoices & Document Studio
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Inspect generated order invoices, customize layout colors & copy, and preview print/PDF output visually.
          </p>
        </div>

        <div className="inline-flex p-1 bg-[#F3F4F6] rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>All Invoices ({invoices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customize')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'customize'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Customize Design & Text</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-[#171717] text-white text-xs px-4 py-3 rounded-2xl flex items-center justify-between gap-4">
          <span>{msg}</span>
          <button
            type="button"
            onClick={() => setMsg('')}
            className="text-white/70 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================== TAB 1: ALL INVOICES ==================== */}
      {activeTab === 'all' && (
        <div className="space-y-5">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#F0F1F3] rounded-2xl p-4">
              <p className="text-xs font-medium text-[#6B7280]">Total Invoices</p>
              <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
                {metrics.totalCount}
              </p>
            </div>
            <div className="bg-white border border-[#F0F1F3] rounded-2xl p-4">
              <p className="text-xs font-medium text-[#6B7280]">Paid</p>
              <p className="text-2xl font-extrabold text-[#15803D] mt-1 tabular-nums">
                {metrics.paidCount}
              </p>
            </div>
            <div className="bg-white border border-[#F0F1F3] rounded-2xl p-4">
              <p className="text-xs font-medium text-[#6B7280]">Unpaid / COD Due</p>
              <p className="text-2xl font-extrabold text-[#9A3412] mt-1 tabular-nums">
                {metrics.unpaidCount}
              </p>
            </div>
            <div className="bg-white border border-[#F0F1F3] rounded-2xl p-4">
              <p className="text-xs font-medium text-[#6B7280]">Total Invoiced</p>
              <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
                {currency}
                {metrics.totalRevenue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  placeholder="Search invoice #, order #, or customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2.5 text-xs bg-white border border-[#E5E7EB] rounded-2xl w-72 focus:outline-none focus:ring-2 focus:ring-[#171717]"
                />
              </div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3.5 py-2.5 text-xs bg-white border border-[#E5E7EB] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#171717]"
              >
                <option value="">All Payment Statuses</option>
                <option value="unpaid">Unpaid (COD Due)</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('customize')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold ka-oak-btn rounded-2xl cursor-pointer whitespace-nowrap"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Edit Invoice Design & Text</span>
            </button>
          </div>

          {/* Invoices Table */}
          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#6B7280]">Loading invoices...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-bold text-[#111827]">No matching invoices found</p>
                <p className="text-xs text-[#6B7280]">
                  Invoices are generated automatically for every order placed on the storefront or converted from quotations.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F7F7F8] border-b border-[#F0F1F3] text-[#6B7280]">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Invoice #</th>
                    <th className="py-3.5 px-4 font-semibold">Order Ref</th>
                    <th className="py-3.5 px-4 font-semibold">Issued Date</th>
                    <th className="py-3.5 px-4 font-semibold">Customer</th>
                    <th className="py-3.5 px-4 font-semibold">Items</th>
                    <th className="py-3.5 px-4 font-semibold">Payment</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Amount</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F1F3]">
                  {filteredInvoices.map((inv) => {
                    const invCode = formatInvoiceNumber(
                      inv.orderNumber,
                      designDraft.invoiceNumberPrefix
                    );
                    const qtySum = (inv.items || []).reduce(
                      (s: number, it: any) => s + Number(it.quantity || 0),
                      0
                    );
                    return (
                      <tr key={inv.id} className="hover:bg-[#FAFAFB]">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#111827] whitespace-nowrap">
                          {invCode}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#4B5563] whitespace-nowrap">
                          {inv.orderNumber}
                        </td>
                        <td className="py-3.5 px-4 text-[#6B7280] whitespace-nowrap">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#111827]">{inv.customerName}</p>
                          <p className="text-[11px] text-[#6B7280]">
                            {inv.customerEmail} ·{' '}
                            {inv.isRegisteredCustomer ? 'Registered Account' : 'Guest Buyer'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-[#4B5563] tabular-nums whitespace-nowrap">
                          {qtySum} {qtySum === 1 ? 'item' : 'items'}
                        </td>
                        <td className="py-3.5 px-4 capitalize whitespace-nowrap">
                          <span className="font-semibold text-[#111827]">{inv.paymentStatus}</span>
                          <span className="text-[#6B7280]"> · {inv.orderStatus}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-[#111827] tabular-nums whitespace-nowrap">
                          {currency}
                          {Number(inv.totalAmount).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewOrderModal(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#F3F4F6] hover:bg-[#171717] hover:text-white rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap"
                              title="Visual Preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadInvoicePdf({
                                  order: inv,
                                  invoiceSettings: designDraft,
                                  generalSettings: settings.general,
                                  currency,
                                })
                              }
                              className="p-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                printInvoiceDocument({
                                  order: inv,
                                  invoiceSettings: designDraft,
                                  generalSettings: settings.general,
                                  currency,
                                })
                              }
                              className="p-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer"
                              title="Print Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={sendingId === inv.id}
                              onClick={() => handleSendInvoiceEmail(inv.id, inv.customerEmail)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#E5E7EB] hover:border-[#171717] text-[#111827] rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                              title="Send Invoice Email"
                            >
                              <Send className="w-3 h-3" />
                              <span>{sendingId === inv.id ? 'Sending...' : 'Email'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: CUSTOMIZE DESIGN & TEXT ==================== */}
      {activeTab === 'customize' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Controls Panel */}
          <div className="xl:col-span-5 space-y-5">
            {/* Presets & Layout */}
            <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#111827]">
                  Theme Presets & Layout
                </h3>
                <button
                  type="button"
                  onClick={handleResetDesign}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B7280] hover:text-[#111827] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {INVOICE_THEME_PRESETS.map((preset) => {
                  const selected = designDraft.presetName === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() =>
                        setDesignDraft((prev) => ({
                          ...prev,
                          presetName: preset.name,
                          layoutStyle: preset.layoutStyle,
                          headerBgColor: preset.headerBgColor,
                          headerTextColor: preset.headerTextColor,
                          accentColor: preset.accentColor,
                          tableHeaderBgColor: preset.tableHeaderBgColor,
                          tableHeaderTextColor: preset.tableHeaderTextColor,
                          borderColor: preset.borderColor,
                          paperBgColor: preset.paperBgColor,
                          bodyTextColor: preset.bodyTextColor,
                          mutedTextColor: preset.mutedTextColor,
                        }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-[#171717] bg-[#F7F7F8]'
                          : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.headerBgColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.tableHeaderBgColor }}
                        />
                      </div>
                      <p className="text-xs font-bold text-[#111827]">{preset.name}</p>
                      <p className="text-[11px] text-[#6B7280] capitalize">
                        {preset.layoutStyle.replace('_', ' ')}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Header Layout Style
                  </label>
                  <select
                    value={designDraft.layoutStyle}
                    onChange={(e) =>
                      setDesignDraft({
                        ...designDraft,
                        layoutStyle: e.target.value as InvoiceDesignSettings['layoutStyle'],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="classic">Classic Banner</option>
                    <option value="split_banner">Split Accent Banner</option>
                    <option value="minimal">Editorial Minimal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Typography Style
                  </label>
                  <select
                    value={designDraft.fontStyle}
                    onChange={(e) =>
                      setDesignDraft({
                        ...designDraft,
                        fontStyle: e.target.value as InvoiceDesignSettings['fontStyle'],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="sans">Architectural Sans</option>
                    <option value="serif">Editorial Serif</option>
                    <option value="mono">Technical Mono</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5 space-y-3.5">
              <h3 className="text-sm font-extrabold text-[#111827]">
                Visual Color Controls
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INVOICE_COLOR_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F7F7F8] border border-[#E5E7EB]"
                  >
                    <span className="text-xs font-medium text-[#111827] truncate">
                      {field.label}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="color"
                        value={designDraft[field.key]}
                        onChange={(e) =>
                          setDesignDraft({ ...designDraft, [field.key]: e.target.value })
                        }
                        className="w-7 h-7 rounded-lg border border-[#D1D5DB] cursor-pointer bg-transparent p-0"
                        aria-label={field.label}
                      />
                      <input
                        type="text"
                        value={designDraft[field.key]}
                        onChange={(e) =>
                          setDesignDraft({ ...designDraft, [field.key]: e.target.value })
                        }
                        className="w-18 px-1.5 py-1 text-[11px] font-mono bg-white border border-[#E5E7EB] rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Brand Identity & Logo */}
            <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5 space-y-3.5">
              <h3 className="text-sm font-extrabold text-[#111827]">
                Studio Branding & Logo
              </h3>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>

                {mediaAssets.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setDesignDraft({ ...designDraft, logoUrl: e.target.value, showLogo: true });
                      }
                    }}
                    className="px-3 py-2 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl max-w-[180px]"
                  >
                    <option value="">Choose from Media Library...</option>
                    {mediaAssets.map((m) => (
                      <option key={m.id} value={m.url}>
                        {m.filename || m.altText || `Asset #${m.id}`}
                      </option>
                    ))}
                  </select>
                )}

                {designDraft.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setDesignDraft({ ...designDraft, logoUrl: '' })}
                    className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                  >
                    Clear Logo
                  </button>
                )}
              </div>

              <input
                placeholder="Logo Image URL (optional)"
                value={designDraft.logoUrl}
                onChange={(e) => setDesignDraft({ ...designDraft, logoUrl: e.target.value })}
                className={inputClass}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Document Heading
                  </label>
                  <input
                    value={designDraft.documentTitle}
                    onChange={(e) =>
                      setDesignDraft({ ...designDraft, documentTitle: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Invoice # Prefix
                  </label>
                  <input
                    value={designDraft.invoiceNumberPrefix}
                    onChange={(e) =>
                      setDesignDraft({ ...designDraft, invoiceNumberPrefix: e.target.value })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Business Name Override
                  </label>
                  <input
                    placeholder={settings.general?.siteName || 'Kanso Atelier'}
                    value={designDraft.companyName}
                    onChange={(e) =>
                      setDesignDraft({ ...designDraft, companyName: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Subtitle / Tagline
                  </label>
                  <input
                    value={designDraft.companySubtitle}
                    onChange={(e) =>
                      setDesignDraft({ ...designDraft, companySubtitle: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <input
                placeholder={`Studio Address (${settings.general?.address || 'Default store address'})`}
                value={designDraft.companyAddress}
                onChange={(e) =>
                  setDesignDraft({ ...designDraft, companyAddress: e.target.value })
                }
                className={inputClass}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  placeholder={settings.general?.contactEmail || 'Billing Email'}
                  value={designDraft.companyEmail}
                  onChange={(e) =>
                    setDesignDraft({ ...designDraft, companyEmail: e.target.value })
                  }
                  className={inputClass}
                />
                <input
                  placeholder={settings.general?.phone || 'Phone'}
                  value={designDraft.companyPhone}
                  onChange={(e) =>
                    setDesignDraft({ ...designDraft, companyPhone: e.target.value })
                  }
                  className={inputClass}
                />
                <input
                  placeholder="Tax / VAT ID"
                  value={designDraft.taxIdText}
                  onChange={(e) => setDesignDraft({ ...designDraft, taxIdText: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Editable Text, Labels & Terms */}
            <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5 space-y-3.5">
              <h3 className="text-sm font-extrabold text-[#111827]">
                Section Labels, Terms & Footer Copy
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Billed To Label
                  </label>
                  <input
                    value={designDraft.billedToLabel}
                    onChange={(e) =>
                      setDesignDraft({ ...designDraft, billedToLabel: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Ship To Label
                  </label>
                  <input
                    value={designDraft.shipToLabel}
                    onChange={(e) =>
                      setDesignDraft({ ...designDraft, shipToLabel: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Items Section Heading
                  </label>
                  <input
                    value={designDraft.itemsHeading}
                    onChange={(e) =>
                      setDesignDraft({ ...designDraft, itemsHeading: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                    Payment Label
                  </label>
                  <input
                    value={designDraft.paymentMethodLabel}
                    onChange={(e) =>
                      setDesignDraft({ ...designDraft, paymentMethodLabel: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                  Payment Terms Heading
                </label>
                <input
                  value={designDraft.paymentTermsTitle}
                  onChange={(e) =>
                    setDesignDraft({ ...designDraft, paymentTermsTitle: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                  Payment & Fulfillment Terms Copy
                </label>
                <textarea
                  rows={3}
                  value={designDraft.paymentTermsText}
                  onChange={(e) =>
                    setDesignDraft({ ...designDraft, paymentTermsText: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                  Thank-You Line
                </label>
                <input
                  value={designDraft.thankYouHeading}
                  onChange={(e) =>
                    setDesignDraft({ ...designDraft, thankYouHeading: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#6B7280] mb-1">
                  Footer Legal / Support Text
                </label>
                <textarea
                  rows={2}
                  value={designDraft.footerNotes}
                  onChange={(e) =>
                    setDesignDraft({ ...designDraft, footerNotes: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {/* Visibility Switches */}
            <div className="bg-white border border-[#F0F1F3] rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#111827]">Visible Blocks</h3>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {(
                  [
                    ['showLogo', 'Display Uploaded Logo'],
                    ['showBillingAddress', 'Billing Address Column'],
                    ['showShippingAddress', 'Shipping Address Column'],
                    ['showPaymentStatusBadge', 'Payment Status Header'],
                    ['showSku', 'Product SKUs'],
                    ['showVariation', 'Finish / Variation Details'],
                    ['showDiscountRow', 'Discount Line'],
                    ['showTaxBreakdown', 'Tax Line'],
                    ['showNotesSection', 'Terms & Customer Notes'],
                  ] as Array<[keyof InvoiceDesignSettings, string]>
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F7F7F8] border border-[#E5E7EB] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(designDraft[key])}
                      onChange={(e) =>
                        setDesignDraft({ ...designDraft, [key]: e.target.checked })
                      }
                      className="rounded border-slate-300 text-[#171717] focus:ring-[#171717]"
                    />
                    <span className="font-medium text-[#111827]">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Sticky Action */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveDesign}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 text-xs font-bold ka-oak-btn rounded-2xl cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving Invoice Design...' : 'Save Invoice Design'}</span>
              </button>
            </div>
          </div>

          {/* Right Live Visual Preview Canvas */}
          <div className="xl:col-span-7 xl:sticky xl:top-20 space-y-4">
            <div className="bg-white border border-[#F0F1F3] rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-extrabold text-[#111827]">
                  Live Visual Invoice Preview
                </span>
                <select
                  value={studioSampleId}
                  onChange={(e) => setStudioSampleId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                >
                  <option value="sample">Sample Architectural Order</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={String(inv.id)}>
                      {inv.orderNumber} · {inv.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadInvoicePdf({
                      order: studioPreviewOrder,
                      invoiceSettings: designDraft,
                      generalSettings: settings.general,
                      currency,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printInvoiceDocument({
                      order: studioPreviewOrder,
                      invoiceSettings: designDraft,
                      generalSettings: settings.general,
                      currency,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudioFullscreen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#171717] text-white rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Expand</span>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-3xl bg-[#ECEEEF] border border-[#E5E7EB]">
              <InvoicePreviewSheet
                order={studioPreviewOrder}
                invoiceSettings={designDraft}
                generalSettings={settings.general}
                currency={currency}
                compact
              />
            </div>
          </div>
        </div>
      )}

      {/* Visual Modal for All Invoices or Fullscreen Studio */}
      {(previewOrderModal || studioFullscreen) && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewOrderModal(null);
              setStudioFullscreen(false);
            }
          }}
        >
          <div className="w-full max-w-4xl space-y-4 my-auto">
            <div className="bg-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
              <div>
                <p className="text-sm font-extrabold text-[#111827]">
                  {formatInvoiceNumber(
                    (previewOrderModal || studioPreviewOrder).orderNumber,
                    designDraft.invoiceNumberPrefix
                  )}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {(previewOrderModal || studioPreviewOrder).customerName} ·{' '}
                  {(previewOrderModal || studioPreviewOrder).customerEmail}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadInvoicePdf({
                      order: previewOrderModal || studioPreviewOrder,
                      invoiceSettings: designDraft,
                      generalSettings: settings.general,
                      currency,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printInvoiceDocument({
                      order: previewOrderModal || studioPreviewOrder,
                      invoiceSettings: designDraft,
                      generalSettings: settings.general,
                      currency,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Invoice</span>
                </button>
                {previewOrderModal?.id ? (
                  <button
                    type="button"
                    disabled={sendingId === previewOrderModal.id}
                    onClick={() =>
                      handleSendInvoiceEmail(
                        previewOrderModal.id!,
                        previewOrderModal.customerEmail
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold ka-oak-btn rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {sendingId === previewOrderModal.id ? 'Sending...' : 'Email Customer'}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOrderModal(null);
                    setStudioFullscreen(false);
                  }}
                  className="p-2 rounded-xl bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB] cursor-pointer"
                  aria-label="Close invoice preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <InvoicePreviewSheet
              order={previewOrderModal || studioPreviewOrder}
              invoiceSettings={designDraft}
              generalSettings={settings.general}
              currency={currency}
            />
          </div>
        </div>
      )}
    </div>
  );
};
