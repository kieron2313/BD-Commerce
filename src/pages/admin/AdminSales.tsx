import React, { useEffect, useState } from 'react';
import {
  Download,
  Send,
  ArrowRightCircle,
  Printer,
  Plus,
  Trash2,
  X,
  ExternalLink,
  Eye,
  Receipt,
  UserCheck,
  ShoppingBag,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { downloadInvoicePdf, downloadQuotationPdf } from '../../utils/pdf';
import { InvoiceOrderData, formatInvoiceNumber } from '../../utils/invoiceRenderer';
import { InvoicePreviewSheet, printInvoiceDocument } from '../../components/InvoicePreviewSheet';
import { AdminShipping } from './AdminShipping';

export const AdminSales: React.FC<{
  section: 'orders' | 'inquiries' | 'quotations' | 'customers' | 'coupons' | 'shipping';
}> = ({ section }) => {
  const { authFetch, settings } = usePlatform();
  const currency = settings.general?.currencySymbol || '$';
  const invoicePrefix = settings.invoice?.invoiceNumberPrefix || 'INV-';

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);

  const [quotations, setQuotations] = useState<any[]>([]);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerNotesDraft, setCustomerNotesDraft] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'registered' | 'guest'>('all');
  const [invoicePreviewOrder, setInvoicePreviewOrder] = useState<InvoiceOrderData | null>(null);

  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponForm, setCouponForm] = useState<any>({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    minPurchaseAmount: 0,
    maxDiscountAmount: '',
    maxUsage: '',
    isActive: true,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    if (section === 'orders') {
      const r = await authFetch('/api/admin/orders');
      if (r.ok) setOrders((await r.json()).orders || []);
    } else if (section === 'inquiries') {
      const r = await authFetch('/api/admin/inquiries');
      if (r.ok) setInquiries((await r.json()).inquiries || []);
    } else if (section === 'quotations') {
      const [qRes, pRes] = await Promise.all([
        authFetch('/api/admin/quotations'),
        authFetch('/api/admin/products'),
      ]);
      if (qRes.ok) setQuotations((await qRes.json()).quotations || []);
      if (pRes.ok) setCatalogProducts((await pRes.json()).products || []);
    } else if (section === 'customers') {
      const r = await authFetch('/api/admin/customers');
      if (r.ok) setCustomers((await r.json()).customers || []);
    } else if (section === 'coupons') {
      const r = await authFetch('/api/admin/coupons');
      if (r.ok) setCoupons((await r.json()).coupons || []);
    }
  };

  useEffect(() => {
    setSelectedOrder(null);
    setSelectedInquiry(null);
    setEditingQuote(null);
    setSelectedCustomer(null);
    setInvoicePreviewOrder(null);
    setCustomerFilter('all');
    setSearch('');
    setStatusFilter('');
    loadData();
  }, [section]);

  const openOrderDetail = async (id: number) => {
    const r = await authFetch(`/api/admin/orders/${id}`);
    if (r.ok) setSelectedOrder(await r.json());
  };

  const openInquiryDetail = async (id: number) => {
    const r = await authFetch(`/api/admin/inquiries/${id}`);
    if (r.ok) setSelectedInquiry(await r.json());
  };

  const openQuotationEditor = async (id?: number) => {
    if (!id) {
      setEditingQuote({
        id: null,
        customerName: '',
        companyName: '',
        email: '',
        phone: '',
        status: 'draft',
        discountType: 'fixed',
        discountValue: 0,
        shippingCost: 0,
        taxRate: 8.5,
        additionalFees: 0,
        notes: '',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        items: [],
      });
      return;
    }
    const r = await authFetch(`/api/admin/quotations/${id}`);
    if (r.ok) {
      const d = await r.json();
      setEditingQuote({
        ...d.quotation,
        expiresAt: d.quotation.expiresAt ? new Date(d.quotation.expiresAt).toISOString().slice(0, 10) : '',
        items: d.items || [],
      });
    }
  };

  const saveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = !editingQuote.id;
    const res = await authFetch(
      isNew ? '/api/admin/quotations' : `/api/admin/quotations/${editingQuote.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(editingQuote),
      }
    );
    const d = await res.json();
    if (res.ok) {
      setMsg(`Quotation ${d.quotation.quoteRef} saved.`);
      setEditingQuote({
        ...d.quotation,
        expiresAt: d.quotation.expiresAt ? new Date(d.quotation.expiresAt).toISOString().slice(0, 10) : '',
        items: d.items || [],
      });
      await loadData();
    } else {
      setMsg(d.error || 'Failed to save quotation.');
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className="bg-slate-900 text-white text-xs px-4 py-2.5 rounded-md flex items-center justify-between">
          <span>{msg}</span>
          <button type="button" onClick={() => setMsg('')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================== ORDERS ==================== */}
      {section === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <input
                placeholder="Search order # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-4 py-2.5 text-xs bg-white border border-[#E5E7EB] rounded-2xl w-64 shadow-xs"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2.5 text-xs bg-white border border-[#E5E7EB] rounded-2xl shadow-xs"
              >
                <option value="">All Statuses</option>
                {['pending', 'processing', 'on_hold', 'shipped', 'completed', 'cancelled', 'refunded'].map(
                  (st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  )
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={async () => {
                const r = await authFetch('/api/admin/orders/export/csv');
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'orders-export.csv';
                a.click();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F7F7F8] border-b border-[#F0F1F3] text-[#6B7280]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Order #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Payment (COD)</th>
                  <th className="py-3 px-4 font-semibold">Order Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3]">
                {orders
                  .filter((o) => {
                    const q = search.toLowerCase();
                    if (statusFilter && o.orderStatus !== statusFilter) return false;
                    return (
                      !q ||
                      o.orderNumber.toLowerCase().includes(q) ||
                      o.customerName.toLowerCase().includes(q) ||
                      o.customerEmail.toLowerCase().includes(q)
                    );
                  })
                  .map((o) => (
                    <tr key={o.id} className="hover:bg-[#FAFAFB]">
                      <td className="py-3 px-4 font-mono font-bold text-[#111827]">{o.orderNumber}</td>
                      <td className="py-3 px-4 text-[#6B7280]">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#111827]">{o.customerName}</p>
                        <p className="text-[13px] text-[#6B7280]">{o.customerEmail}</p>
                      </td>
                      <td className="py-3 px-4 capitalize">
                        {o.paymentMethod.toUpperCase()} · {o.paymentStatus}
                      </td>
                      <td className="py-3 px-4 capitalize font-semibold">{o.orderStatus}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        {currency}
                        {o.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openOrderDetail(o.id)}
                          className="px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#171717] hover:text-white rounded-xl font-semibold transition-all cursor-pointer"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {selectedOrder && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-semibold">
                    Order {selectedOrder.order.orderNumber}
                  </h3>
                  <p className="text-slate-500">
                    {selectedOrder.order.customerName} ({selectedOrder.order.customerEmail})
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <button
                    type="button"
                    onClick={() =>
                      setInvoicePreviewOrder({
                        ...selectedOrder.order,
                        items: selectedOrder.items || [],
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Visual Invoice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadInvoicePdf({
                        order: {
                          ...selectedOrder.order,
                          items: selectedOrder.items || [],
                        },
                        invoiceSettings: settings.invoice,
                        generalSettings: settings.general,
                        currency,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Invoice PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      printInvoiceDocument({
                        order: {
                          ...selectedOrder.order,
                          items: selectedOrder.items || [],
                        },
                        invoiceSettings: settings.invoice,
                        generalSettings: settings.general,
                        currency,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Invoice</span>
                  </button>
                  <button type="button" onClick={() => setSelectedOrder(null)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium mb-1">Order Status</label>
                  <select
                    value={selectedOrder.order.orderStatus}
                    onChange={(e) =>
                      setSelectedOrder({
                        ...selectedOrder,
                        order: { ...selectedOrder.order, orderStatus: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {['pending', 'processing', 'on_hold', 'shipped', 'completed', 'cancelled', 'refunded'].map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Payment Status (COD)</label>
                  <select
                    value={selectedOrder.order.paymentStatus}
                    onChange={(e) =>
                      setSelectedOrder({
                        ...selectedOrder,
                        order: { ...selectedOrder.order, paymentStatus: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {['unpaid', 'paid', 'partially_paid', 'refunded'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Internal Notes</label>
                  <input
                    value={selectedOrder.order.internalNotes || ''}
                    onChange={(e) =>
                      setSelectedOrder({
                        ...selectedOrder,
                        order: { ...selectedOrder.order, internalNotes: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((it: any) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3">
                          <span className="font-medium">{it.productName}</span>
                          {it.variationLabel && (
                            <span className="text-slate-500 ml-1">({it.variationLabel})</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono">{it.sku}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{it.quantity}</td>
                        <td className="py-2 px-3 text-right tabular-nums">${it.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums">
                          ${it.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="text-slate-500">
                  Shipping: {selectedOrder.order.shippingMethodName} (${selectedOrder.order.shippingCost.toFixed(2)}) · Tax: ${selectedOrder.order.taxAmount.toFixed(2)} · Total: <strong>${selectedOrder.order.totalAmount.toFixed(2)}</strong>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const r = await authFetch(`/api/admin/orders/${selectedOrder.order.id}`, {
                      method: 'PUT',
                      body: JSON.stringify(selectedOrder.order),
                    });
                    if (r.ok) {
                      setMsg('Order updated and customer notified.');
                      await openOrderDetail(selectedOrder.order.id);
                      await loadData();
                    }
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md font-medium"
                >
                  Save Order Changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== INQUIRIES ==================== */}
      {section === 'inquiries' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              placeholder="Search inquiry ref or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-md w-64"
            />
            <button
              type="button"
              onClick={async () => {
                const r = await authFetch('/api/admin/inquiries/export/csv');
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'inquiries-export.csv';
                a.click();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Ref</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inquiries
                  .filter(
                    (i) =>
                      !search ||
                      i.inquiryRef.toLowerCase().includes(search.toLowerCase()) ||
                      i.customerName.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((inq) => (
                    <tr key={inq.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold">{inq.inquiryRef}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(inq.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{inq.customerName}</p>
                        <p className="text-[13px] text-slate-500">
                          {inq.companyName ? `${inq.companyName} · ` : ''}
                          {inq.email}
                        </p>
                      </td>
                      <td className="py-3 px-4 capitalize font-medium">{inq.status}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openInquiryDetail(inq.id)}
                          className="font-medium hover:underline"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {selectedInquiry && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-semibold">
                    Inquiry {selectedInquiry.inquiry.inquiryRef}
                  </h3>
                  <p className="text-slate-600 mt-0.5">
                    {selectedInquiry.inquiry.customerName} · {selectedInquiry.inquiry.email} ·{' '}
                    {selectedInquiry.inquiry.phone}
                  </p>
                  {selectedInquiry.inquiry.message && (
                    <p className="mt-2 p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">
                      {selectedInquiry.inquiry.message}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedInquiry(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3">Variation</th>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInquiry.items.map((it: any) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-medium">{it.productName}</td>
                        <td className="py-2 px-3 text-slate-500">{it.variationLabel || 'Standard'}</td>
                        <td className="py-2 px-3 font-mono">{it.sku}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold">{it.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1">Status</label>
                  <select
                    value={selectedInquiry.inquiry.status}
                    onChange={(e) =>
                      setSelectedInquiry({
                        ...selectedInquiry,
                        inquiry: { ...selectedInquiry.inquiry, status: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {['new', 'in_review', 'quoted', 'responded', 'converted', 'closed'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Internal Notes</label>
                  <input
                    value={selectedInquiry.inquiry.internalNotes || ''}
                    onChange={(e) =>
                      setSelectedInquiry({
                        ...selectedInquiry,
                        inquiry: { ...selectedInquiry.inquiry, internalNotes: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await authFetch(
                        `/api/admin/inquiries/${selectedInquiry.inquiry.id}/create-quotation`,
                        { method: 'POST' }
                      );
                      const d = await r.json();
                      if (r.ok) {
                        setMsg(`Created Quotation ${d.quotation.quoteRef} from inquiry.`);
                        await openInquiryDetail(selectedInquiry.inquiry.id);
                        await loadData();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-md font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Quotation</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await authFetch(
                        `/api/admin/inquiries/${selectedInquiry.inquiry.id}/convert-to-order`,
                        { method: 'POST' }
                      );
                      const d = await r.json();
                      if (r.ok) {
                        setMsg(`Converted directly to Order ${d.order.orderNumber}.`);
                        await openInquiryDetail(selectedInquiry.inquiry.id);
                        await loadData();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-900 text-slate-900 rounded-md font-medium"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    <span>Convert to Order</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await authFetch(`/api/admin/inquiries/${selectedInquiry.inquiry.id}`, {
                      method: 'PUT',
                      body: JSON.stringify(selectedInquiry.inquiry),
                    });
                    setMsg('Inquiry updated.');
                    await loadData();
                  }}
                  className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-md font-medium"
                >
                  Save Status & Notes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== QUOTATIONS ==================== */}
      {section === 'quotations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Quotation Management</h3>
            <button
              type="button"
              onClick={() => openQuotationEditor()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Quotation</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Quote Ref</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Expires</th>
                  <th className="py-3 px-4 font-semibold text-right">Grand Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-semibold">{q.quoteRef}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{q.customerName}</p>
                      <p className="text-[13px] text-slate-500">{q.email}</p>
                    </td>
                    <td className="py-3 px-4 capitalize font-medium">{q.status}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {q.expiresAt ? new Date(q.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums">
                      {currency}
                      {q.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-3">
                      <button
                        type="button"
                        onClick={() => openQuotationEditor(q.id)}
                        className="font-medium hover:underline"
                      >
                        Edit / Deliver
                      </button>
                      <a
                        href={`/quotation/${q.quoteRef}?token=${q.secureToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                      >
                        <span>Customer Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingQuote && (
            <form
              onSubmit={saveQuotation}
              className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h4 className="text-base font-semibold">
                    {editingQuote.id ? `Edit Quotation ${editingQuote.quoteRef}` : 'Create Quotation'}
                  </h4>
                  {editingQuote.id && (
                    <p className="text-slate-500 mt-0.5">
                      Status: <strong className="uppercase">{editingQuote.status}</strong>
                      {editingQuote.convertedOrderId && ' · Converted to Order'}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setEditingQuote(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  required
                  placeholder="Customer Name *"
                  value={editingQuote.customerName}
                  onChange={(e) => setEditingQuote({ ...editingQuote, customerName: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-md"
                />
                <input
                  placeholder="Company Name"
                  value={editingQuote.companyName || ''}
                  onChange={(e) => setEditingQuote({ ...editingQuote, companyName: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-md"
                />
                <input
                  required
                  type="email"
                  placeholder="Email *"
                  value={editingQuote.email}
                  onChange={(e) => setEditingQuote({ ...editingQuote, email: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-md"
                />
                <input
                  type="date"
                  value={editingQuote.expiresAt || ''}
                  onChange={(e) => setEditingQuote({ ...editingQuote, expiresAt: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              {/* Add Product Selector */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="font-medium">Add Item to Quote:</span>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const [pIdStr, vIdStr] = val.split(':');
                    const prod = catalogProducts.find((p) => p.id === Number(pIdStr));
                    if (!prod) return;
                    const v = vIdStr
                      ? prod.variations?.find((x: any) => x.id === Number(vIdStr))
                      : null;
                    const newItem = {
                      productId: prod.id,
                      variationId: v?.id || null,
                      productName: prod.name,
                      productImage: v?.imageUrl || prod.mainImageUrl,
                      sku: v?.sku || prod.sku,
                      variationLabel: v
                        ? (v.attributes || []).map((a: any) => `${a.attributeName}: ${a.value}`).join(' · ')
                        : '',
                      quantity: 1,
                      unitPrice: v ? v.salePrice ?? v.regularPrice : prod.salePrice ?? prod.regularPrice,
                      lineDiscount: 0,
                    };
                    setEditingQuote({
                      ...editingQuote,
                      items: [...(editingQuote.items || []), newItem],
                    });
                    e.target.value = '';
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded bg-white flex-1 min-w-[240px]"
                >
                  <option value="">Select product or variation...</option>
                  {catalogProducts.map((p) =>
                    p.variations?.length > 0 ? (
                      p.variations.map((v: any) => (
                        <option key={`${p.id}:${v.id}`} value={`${p.id}:${v.id}`}>
                          {p.name} — {(v.attributes || []).map((a: any) => a.value).join(' / ')} ({v.sku}) · $
                          {v.salePrice ?? v.regularPrice}
                        </option>
                      ))
                    ) : (
                      <option key={`${p.id}:`} value={`${p.id}:`}>
                        {p.name} ({p.sku}) · ${p.salePrice ?? p.regularPrice}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Line Items Editor */}
              <div className="space-y-2">
                {(editingQuote.items || []).map((it: any, idx: number) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center p-2.5 border border-slate-200 rounded"
                  >
                    <div className="col-span-4">
                      <p className="font-medium">{it.productName}</p>
                      <p className="text-[13px] text-slate-500 font-mono">
                        {it.sku} {it.variationLabel ? `· ${it.variationLabel}` : ''}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[12px] text-slate-500 block">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => {
                          const next = [...editingQuote.items];
                          next[idx] = { ...it, quantity: Number(e.target.value) };
                          setEditingQuote({ ...editingQuote, items: next });
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded tabular-nums"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[12px] text-slate-500 block">Unit Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={it.unitPrice}
                        onChange={(e) => {
                          const next = [...editingQuote.items];
                          next[idx] = { ...it, unitPrice: Number(e.target.value) };
                          setEditingQuote({ ...editingQuote, items: next });
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded tabular-nums"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[12px] text-slate-500 block">Line Discount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={it.lineDiscount}
                        onChange={(e) => {
                          const next = [...editingQuote.items];
                          next[idx] = { ...it, lineDiscount: Number(e.target.value) };
                          setEditingQuote({ ...editingQuote, items: next });
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded tabular-nums"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="font-semibold tabular-nums">
                        ${Math.max(0, it.unitPrice * it.quantity - (it.lineDiscount || 0)).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuote({
                            ...editingQuote,
                            items: editingQuote.items.filter((_: any, i: number) => i !== idx),
                          });
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Overall Calculations */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block font-medium mb-1">Discount Type</label>
                  <select
                    value={editingQuote.discountType}
                    onChange={(e) => setEditingQuote({ ...editingQuote, discountType: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="fixed">Fixed ($)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingQuote.discountValue}
                    onChange={(e) =>
                      setEditingQuote({ ...editingQuote, discountValue: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Shipping ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingQuote.shippingCost}
                    onChange={(e) =>
                      setEditingQuote({ ...editingQuote, shippingCost: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingQuote.taxRate}
                    onChange={(e) =>
                      setEditingQuote({ ...editingQuote, taxRate: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Additional Fees ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingQuote.additionalFees}
                    onChange={(e) =>
                      setEditingQuote({ ...editingQuote, additionalFees: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded tabular-nums"
                  />
                </div>
              </div>

              <textarea
                rows={2}
                placeholder="Quotation notes & commercial terms..."
                value={editingQuote.notes || ''}
                onChange={(e) => setEditingQuote({ ...editingQuote, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 text-white rounded-md font-medium"
                  >
                    Save & Recalculate
                  </button>
                  {editingQuote.id && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          downloadQuotationPdf({
                            ...editingQuote,
                            company: settings.general,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-md"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await authFetch(`/api/admin/quotations/${editingQuote.id}/send`, {
                            method: 'POST',
                          });
                          const d = await r.json();
                          if (r.ok) {
                            setMsg(`Quotation emailed to ${editingQuote.email}. Link: ${d.quoteUrl}`);
                            await openQuotationEditor(editingQuote.id);
                            await loadData();
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-900 text-slate-900 rounded-md font-medium"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to Customer</span>
                      </button>
                      {!editingQuote.convertedOrderId && (
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await authFetch(
                              `/api/admin/quotations/${editingQuote.id}/convert-to-order`,
                              { method: 'POST' }
                            );
                            const d = await r.json();
                            if (r.ok) {
                              setMsg(`Converted into COD Order ${d.order.orderNumber}!`);
                              await openQuotationEditor(editingQuote.id);
                              await loadData();
                            } else {
                              setMsg(d.error || 'Conversion failed.');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white rounded-md font-medium"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          <span>Convert to Order</span>
                        </button>
                      )}
                    </>
                  )}
                </div>

                {editingQuote.grandTotal !== undefined && (
                  <div className="text-right tabular-nums">
                    <span className="text-slate-500 mr-2">Grand Total:</span>
                    <span className="text-base font-bold text-slate-900">
                      ${Number(editingQuote.grandTotal).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* ==================== CUSTOMERS & REGISTERED PURCHASES ==================== */}
      {section === 'customers' && (
        <div className="space-y-5">
          {/* Customer Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#F0F1F3] rounded-2xl p-4">
              <p className="text-xs font-medium text-[#6B7280]">Total Accounts</p>
              <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
                {customers.length}
              </p>
            </div>
            <div className="bg-white border border-[#F0F1F3] rounded-2xl p-4">
              <p className="text-xs font-medium text-[#6B7280]">Registered Users</p>
              <p className="text-2xl font-extrabold text-[#15803D] mt-1 tabular-nums">
                {customers.filter((c) => c.isRegistered).length}
              </p>
            </div>
            <div className="bg-white border border-[#F0F1F3] rounded-2xl p-4">
              <p className="text-xs font-medium text-[#6B7280]">Total Customer Orders</p>
              <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
                {customers.reduce((acc, c) => acc + Number(c.ordersCount || 0), 0)}
              </p>
            </div>
            <div className="bg-white border border-[#F0F1F3] rounded-2xl p-4">
              <p className="text-xs font-medium text-[#6B7280]">Combined Purchase Revenue</p>
              <p className="text-2xl font-extrabold text-[#111827] mt-1 tabular-nums">
                {currency}
                {customers
                  .reduce((acc, c) => acc + Number(c.totalSpent || 0), 0)
                  .toFixed(2)}
              </p>
            </div>
          </div>

          {/* Search & Account Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              placeholder="Search name, email, company, or order #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2.5 text-xs bg-white border border-[#E5E7EB] rounded-2xl w-80 focus:outline-none focus:ring-2 focus:ring-[#171717]"
            />

            <div className="inline-flex p-1 bg-[#F3F4F6] rounded-2xl">
              {(
                [
                  ['all', `All Accounts (${customers.length})`],
                  ['registered', `Registered Users (${customers.filter((c) => c.isRegistered).length})`],
                  ['guest', `Checkout Buyers (${customers.filter((c) => !c.isRegistered).length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCustomerFilter(key)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    customerFilter === key
                      ? 'bg-[#171717] text-white shadow-xs'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Customers Table */}
          <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F7F7F8] border-b border-[#F0F1F3] text-[#6B7280]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Customer</th>
                  <th className="py-3.5 px-4 font-semibold">Account Status</th>
                  <th className="py-3.5 px-4 font-semibold">Location</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Purchases</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Total Spent</th>
                  <th className="py-3.5 px-4 font-semibold">Last Order</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3]">
                {customers
                  .filter((c) => {
                    if (customerFilter === 'registered' && !c.isRegistered) return false;
                    if (customerFilter === 'guest' && c.isRegistered) return false;
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
                      String(c.displayName || '').toLowerCase().includes(q) ||
                      String(c.email || '').toLowerCase().includes(q) ||
                      String(c.companyName || '').toLowerCase().includes(q) ||
                      String(c.lastOrderNumber || '').toLowerCase().includes(q)
                    );
                  })
                  .map((c) => {
                    const displayFullName =
                      `${c.firstName || ''} ${c.lastName || ''}`.trim() ||
                      c.displayName ||
                      c.email;
                    const initials = displayFullName
                      .split(/\s+/)
                      .map((part: string) => part[0] || '')
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <tr key={c.id} className="hover:bg-[#FAFAFB]">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {c.photoUrl ? (
                              <img
                                src={c.photoUrl}
                                alt={displayFullName}
                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#E5E7EB]"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#F3F4F6] text-[#111827] font-bold text-[11px] flex items-center justify-center shrink-0">
                                {initials || 'C'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-[#111827] truncate">
                                {displayFullName}
                              </p>
                              <p className="text-[11px] text-[#6B7280] truncate">
                                {c.email}
                                {c.companyName ? ` · ${c.companyName}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {c.isRegistered ? (
                            <div>
                              <p className="font-semibold text-[#15803D] inline-flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Registered · {c.roleName || 'Customer'}</span>
                              </p>
                              {c.registeredAt && (
                                <p className="text-[11px] text-[#6B7280]">
                                  Joined {new Date(c.registeredAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium text-[#4B5563]">Checkout Buyer</p>
                              <p className="text-[11px] text-[#9CA3AF]">Guest record</p>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#6B7280]">
                          {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">
                          <span className="font-bold text-[#111827]">{c.ordersCount || 0}</span>{' '}
                          <span className="text-[#6B7280]">
                            ({c.purchasedItemsCount || 0} items)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-[#111827] tabular-nums whitespace-nowrap">
                          {currency}
                          {Number(c.totalSpent || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {c.lastOrderNumber ? (
                            <div>
                              <p className="font-mono font-semibold text-[#111827]">
                                {c.lastOrderNumber}
                              </p>
                              <p className="text-[11px] text-[#6B7280]">
                                {new Date(c.lastPurchaseAt).toLocaleDateString()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[#9CA3AF]">No purchases</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await authFetch(`/api/admin/customers/${c.id}`);
                              if (r.ok) {
                                const detail = await r.json();
                                setSelectedCustomer(detail);
                                setCustomerNotesDraft(detail.customer?.notes || '');
                              }
                            }}
                            className="px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#171717] hover:text-white rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap"
                          >
                            View Purchases
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Customer Detail & Full Purchase History */}
          {selectedCustomer && (
            <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl p-6 space-y-6 text-xs">
              <div className="flex flex-wrap justify-between items-start gap-4 border-b border-[#F0F1F3] pb-5">
                <div className="flex items-center gap-4">
                  {selectedCustomer.registeredUser?.photoUrl ? (
                    <img
                      src={selectedCustomer.registeredUser.photoUrl}
                      alt={selectedCustomer.customer.firstName}
                      className="w-12 h-12 rounded-full object-cover border border-[#E5E7EB]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#171717] text-white font-extrabold text-sm flex items-center justify-center">
                      {`${selectedCustomer.customer.firstName?.[0] || ''}${selectedCustomer.customer.lastName?.[0] || ''}`.toUpperCase() ||
                        'CU'}
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-extrabold text-[#111827]">
                      {`${selectedCustomer.customer.firstName || ''} ${selectedCustomer.customer.lastName || ''}`.trim() ||
                        selectedCustomer.registeredUser?.displayName ||
                        selectedCustomer.customer.email}
                    </h4>
                    <p className="text-[#6B7280] mt-0.5">
                      {selectedCustomer.customer.email}
                      {selectedCustomer.customer.phone
                        ? ` · ${selectedCustomer.customer.phone}`
                        : ''}
                      {selectedCustomer.customer.companyName
                        ? ` · ${selectedCustomer.customer.companyName}`
                        : ''}
                    </p>
                    <p className="text-[11px] font-semibold mt-1 text-[#15803D]">
                      {selectedCustomer.registeredUser
                        ? `Registered Account · Role: ${selectedCustomer.registeredUser.roleName} · Joined ${new Date(selectedCustomer.registeredUser.createdAt).toLocaleDateString()}`
                        : 'Checkout Customer Record (Not yet signed in)'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Lifetime Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F7F7F8]">
                  <p className="text-[11px] text-[#6B7280]">Completed & Active Orders</p>
                  <p className="text-lg font-extrabold text-[#111827] tabular-nums mt-0.5">
                    {selectedCustomer.stats?.ordersCount ?? selectedCustomer.orders.length}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F7F7F8]">
                  <p className="text-[11px] text-[#6B7280]">Items Purchased</p>
                  <p className="text-lg font-extrabold text-[#111827] tabular-nums mt-0.5">
                    {selectedCustomer.stats?.purchasedItemsCount ?? 0}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F7F7F8]">
                  <p className="text-[11px] text-[#6B7280]">Total Spent</p>
                  <p className="text-lg font-extrabold text-[#15803D] tabular-nums mt-0.5">
                    {currency}
                    {Number(selectedCustomer.stats?.totalSpent ?? 0).toFixed(2)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F7F7F8]">
                  <p className="text-[11px] text-[#6B7280]">Average Order Value</p>
                  <p className="text-lg font-extrabold text-[#111827] tabular-nums mt-0.5">
                    {currency}
                    {Number(selectedCustomer.stats?.avgOrderValue ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Editable CRM Note & Delivery Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-[#EAECEF] space-y-1">
                  <p className="font-bold text-[#111827]">Saved Address</p>
                  <p className="text-[#6B7280]">
                    {[
                      selectedCustomer.customer.shippingAddress,
                      selectedCustomer.customer.city,
                      selectedCustomer.customer.stateRegion,
                      selectedCustomer.customer.postalCode,
                      selectedCustomer.customer.country,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'No saved shipping address'}
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-[#EAECEF] flex flex-col gap-2">
                  <p className="font-bold text-[#111827]">Internal Customer Note</p>
                  <div className="flex gap-2">
                    <input
                      value={customerNotesDraft}
                      onChange={(e) => setCustomerNotesDraft(e.target.value)}
                      placeholder="VIP preference, freight requirement, trade discount tier..."
                      className="flex-1 px-3 py-1.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await authFetch(
                          `/api/admin/customers/${selectedCustomer.customer.id}`,
                          {
                            method: 'PUT',
                            body: JSON.stringify({ notes: customerNotesDraft }),
                          }
                        );
                        if (r.ok) {
                          setMsg('Customer internal notes saved.');
                        }
                      }}
                      className="px-3 py-1.5 bg-[#171717] text-white font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Itemized Purchase History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-extrabold text-[#111827] flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Itemized Purchase History ({selectedCustomer.orders.length})</span>
                  </h5>
                </div>

                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-[#6B7280] py-3">
                    This registered customer has not completed a purchase yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {selectedCustomer.orders.map((o: any) => (
                      <div
                        key={o.id}
                        className="border border-[#E5E7EB] rounded-2xl overflow-hidden"
                      >
                        <div className="bg-[#F7F7F8] px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB]">
                          <div>
                            <p className="font-mono font-bold text-[#111827]">
                              {o.orderNumber} · Invoice{' '}
                              {formatInvoiceNumber(o.orderNumber, invoicePrefix)}
                            </p>
                            <p className="text-[11px] text-[#6B7280] capitalize">
                              {new Date(o.createdAt).toLocaleDateString()} · Order: {o.orderStatus}{' '}
                              · Payment: {o.paymentStatus}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-[#111827] tabular-nums mr-2">
                              {currency}
                              {Number(o.totalAmount).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setInvoicePreviewOrder(o)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#E5E7EB] hover:border-[#171717] rounded-xl font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visual Invoice</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadInvoicePdf({
                                  order: o,
                                  invoiceSettings: settings.invoice,
                                  generalSettings: settings.general,
                                  currency,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#171717] text-white rounded-xl font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </button>
                          </div>
                        </div>

                        <div className="divide-y divide-[#F0F1F3]">
                          {(o.items || []).map((it: any) => (
                            <div
                              key={it.id}
                              className="px-4 py-2.5 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-[#111827]">{it.productName}</p>
                                <p className="text-[11px] text-[#6B7280] font-mono">
                                  {it.sku}
                                  {it.variationLabel ? ` · ${it.variationLabel}` : ''}
                                </p>
                              </div>
                              <div className="text-right tabular-nums shrink-0">
                                <p className="font-semibold text-[#111827]">
                                  {it.quantity} × {currency}
                                  {Number(it.unitPrice).toFixed(2)}
                                </p>
                                <p className="text-[11px] font-bold text-[#6B7280]">
                                  {currency}
                                  {Number(it.lineTotal).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inquiries & Quotations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#F0F1F3]">
                <div>
                  <p className="font-bold text-[#111827] mb-2">
                    Inquiries ({selectedCustomer.inquiries.length})
                  </p>
                  {selectedCustomer.inquiries.length === 0 ? (
                    <p className="text-[#9CA3AF]">None recorded</p>
                  ) : (
                    selectedCustomer.inquiries.map((i: any) => (
                      <p key={i.id} className="font-mono py-1 text-[#4B5563]">
                        {i.inquiryRef} · {i.status}
                      </p>
                    ))
                  )}
                </div>
                <div>
                  <p className="font-bold text-[#111827] mb-2">
                    Quotations ({selectedCustomer.quotations.length})
                  </p>
                  {selectedCustomer.quotations.length === 0 ? (
                    <p className="text-[#9CA3AF]">None recorded</p>
                  ) : (
                    selectedCustomer.quotations.map((q: any) => (
                      <p key={q.id} className="font-mono py-1 text-[#4B5563] tabular-nums">
                        {q.quoteRef} · {currency}
                        {Number(q.grandTotal).toFixed(2)} ({q.status})
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== COUPONS ==================== */}
      {section === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await authFetch('/api/admin/coupons', {
                method: 'POST',
                body: JSON.stringify(couponForm),
              });
              if (r.ok) {
                setCouponForm({
                  code: '',
                  description: '',
                  discountType: 'percentage',
                  discountValue: 10,
                  minPurchaseAmount: 0,
                  maxDiscountAmount: '',
                  maxUsage: '',
                  isActive: true,
                });
                await loadData();
              }
            }}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs h-fit"
          >
            <h3 className="text-sm font-semibold">Create Coupon</h3>
            <input
              required
              placeholder="Coupon Code (e.g. WINTER20)"
              value={couponForm.code}
              onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
            />
            <select
              value={couponForm.discountType}
              onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
            >
              <option value="percentage">Percentage Discount (%)</option>
              <option value="fixed">Fixed Amount ($)</option>
              <option value="free_shipping">Free Shipping</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Value"
                value={couponForm.discountValue}
                onChange={(e) => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })}
                className="px-3 py-2 border border-slate-300 rounded-md tabular-nums"
              />
              <input
                type="number"
                placeholder="Min Purchase ($)"
                value={couponForm.minPurchaseAmount}
                onChange={(e) =>
                  setCouponForm({ ...couponForm, minPurchaseAmount: Number(e.target.value) })
                }
                className="px-3 py-2 border border-slate-300 rounded-md tabular-nums"
              />
            </div>
            <input
              placeholder="Description"
              value={couponForm.description}
              onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium">
              Create Coupon
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Code</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold text-right">Value</th>
                  <th className="py-3 px-4 font-semibold text-right">Used</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 px-4 font-mono font-semibold">{c.code}</td>
                    <td className="py-3 px-4 capitalize">{c.discountType.replace('_', ' ')}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {c.discountType === 'percentage'
                        ? `${c.discountValue}%`
                        : c.discountType === 'free_shipping'
                        ? 'Free Ship'
                        : `$${c.discountValue}`}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {c.usageCount}
                      {c.maxUsage ? ` / ${c.maxUsage}` : ''}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/coupons/${c.id}`, { method: 'DELETE' });
                          await loadData();
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== SHIPPING ==================== */}
      {section === 'shipping' && <AdminShipping />}

      {/* Visual Invoice Modal */}
      {invoicePreviewOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInvoicePreviewOrder(null);
          }}
        >
          <div className="w-full max-w-4xl space-y-4 my-auto">
            <div className="bg-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
              <div>
                <p className="text-sm font-extrabold text-[#111827]">
                  {formatInvoiceNumber(invoicePreviewOrder.orderNumber, invoicePrefix)}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {invoicePreviewOrder.customerName} · {invoicePreviewOrder.customerEmail}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadInvoicePdf({
                      order: invoicePreviewOrder,
                      invoiceSettings: settings.invoice,
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
                      order: invoicePreviewOrder,
                      invoiceSettings: settings.invoice,
                      generalSettings: settings.general,
                      currency,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold ka-oak-btn rounded-xl cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoicePreviewOrder(null)}
                  className="p-2 rounded-xl bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <InvoicePreviewSheet
              order={invoicePreviewOrder}
              invoiceSettings={settings.invoice}
              generalSettings={settings.general}
              currency={currency}
            />
          </div>
        </div>
      )}
    </div>
  );
};

