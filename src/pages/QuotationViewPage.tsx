import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Download, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { SeoHead } from '../components/SeoHead';
import { downloadQuotationPdf } from '../utils/pdf';
import { SafeImage } from '../components/SafeImage';

export const QuotationViewPage: React.FC = () => {
  const { ref } = useParams<{ ref: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comments, setComments] = useState('');
  const [responding, setResponding] = useState(false);

  const loadQuotation = () => {
    if (!ref) return;
    setLoading(true);
    fetch(`/api/quotations/view/${ref}?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Unable to access quotation.');
        return d;
      })
      .then((res) => {
        setData(res);
        setComments(res.quotation?.customerComments || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuotation();
  }, [ref, token]);

  const handleRespond = async (decision: 'accepted' | 'rejected') => {
    setResponding(true);
    setError('');
    try {
      const res = await fetch(`/api/quotations/respond/${ref}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decision, comments }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to submit response.');
      setData((prev: any) => ({ ...prev, quotation: d.quotation }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="h-64 bg-white border border-[#F0F1F3] rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <SeoHead title="Quotation Access | Kanso Atelier" noIndex />
        <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl p-10">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-2">Quotation Unavailable</h1>
          <p className="text-sm text-[#6B7280]">{error || 'Invalid quotation link.'}</p>
        </div>
      </div>
    );
  }

  const { quotation: q, items, company } = data;
  const canRespond = ['sent', 'viewed', 'draft'].includes(q.status);

  return (
    <>
      <SeoHead title={`Quotation ${q.quoteRef} | Kanso Atelier`} noIndex />
      <div className="ka-container py-12">
        <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl p-6 sm:p-10 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-[#F0F1F3] pb-6">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] mb-1">Formal Commercial Quotation</p>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827]">{q.quoteRef}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] mt-2">
                <span className="font-semibold text-[#111827]">Status: {q.status.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span>Issued: {new Date(q.createdAt).toLocaleDateString()}</span>
                {q.expiresAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Expires: {new Date(q.expiresAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => downloadQuotationPdf({ ...q, items, company })}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-[#F3F4F6] text-[#111827] rounded-2xl hover:bg-[#E5E7EB] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-1">From</p>
              <p className="font-bold text-[#111827]">{company?.siteName || 'Kanso Atelier'}</p>
              <p className="text-[#6B7280]">{company?.address}</p>
              <p className="text-[#6B7280]">{company?.contactEmail}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-1">Prepared For</p>
              <p className="font-bold text-[#111827]">{q.customerName}</p>
              {q.companyName && <p className="text-[#6B7280]">{q.companyName}</p>}
              <p className="text-[#6B7280]">
                {q.email}
                {q.phone ? ` · ${q.phone}` : ''}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto border border-[#F0F1F3] rounded-2xl">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F7F7F8] text-xs text-[#6B7280] border-b border-[#F0F1F3]">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Product</th>
                  <th className="py-3.5 px-4 font-bold">SKU</th>
                  <th className="py-3.5 px-4 font-bold text-right">Qty</th>
                  <th className="py-3.5 px-4 font-bold text-right">Unit Price</th>
                  <th className="py-3.5 px-4 font-bold text-right">Discount</th>
                  <th className="py-3.5 px-4 font-bold text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3]">
                {items.map((it: any) => (
                  <tr key={it.id}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#ECECEE] shrink-0">
                          <SafeImage src={it.productImage} alt={it.productName} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#111827]">{it.productName}</p>
                          {it.variationLabel && (
                            <p className="text-xs text-[#6B7280]">{it.variationLabel}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#6B7280]">{it.sku}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums">{it.quantity}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums">${it.unitPrice.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-[#6B7280]">
                      {it.lineDiscount > 0 ? `-$${it.lineDiscount.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#111827] tabular-nums">
                      ${it.lineTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-2">
            <div className="md:col-span-7 text-sm text-[#4B5563]">
              {q.notes && (
                <div>
                  <p className="text-xs font-bold text-[#111827] mb-1">Terms & Notes</p>
                  <p className="whitespace-pre-line">{q.notes}</p>
                </div>
              )}
              <p className="text-xs text-[#6B7280] mt-4">
                Note: Accepting this quotation confirms pricing and specification. Orders converted from accepted quotations are settled via Cash on Delivery upon dispatch.
              </p>
            </div>
            <div className="md:col-span-5 space-y-2 text-sm tabular-nums bg-[#F7F7F8] p-5 rounded-2xl border border-[#EAECEF]">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Subtotal</span>
                <span>${q.subtotal.toFixed(2)}</span>
              </div>
              {q.totalDiscount > 0 && (
                <div className="flex justify-between text-[#15803D] font-medium">
                  <span>Overall Discount</span>
                  <span>-${q.totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {q.shippingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Shipping & Freight</span>
                  <span>${q.shippingCost.toFixed(2)}</span>
                </div>
              )}
              {q.additionalFees > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Additional Fees</span>
                  <span>${q.additionalFees.toFixed(2)}</span>
                </div>
              )}
              {q.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Tax ({q.taxRate}%)</span>
                  <span>${q.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold text-[#111827] pt-3 border-t border-[#E5E7EB]">
                <span>Grand Total</span>
                <span>${q.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Customer Action Box */}
          <div className="pt-6 border-t border-[#F0F1F3]">
            {q.status === 'accepted' ? (
              <div className="flex items-center gap-3 p-4 bg-[#DCFCE7] border border-[#BBF7D0] rounded-2xl text-[#14532D] text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">Quotation Accepted</p>
                  <p className="text-xs mt-0.5">
                    Our desk has been notified and will convert this quotation into a Cash on Delivery order.
                  </p>
                </div>
              </div>
            ) : q.status === 'rejected' ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm">
                <XCircle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">Quotation Declined</p>
                  <p className="text-xs mt-0.5">Your response and comments have been recorded.</p>
                </div>
              </div>
            ) : q.status === 'expired' ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm">
                This quotation has expired. Please contact our studio for an updated quote.
              </div>
            ) : canRespond ? (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-[#111827]">
                  Comments or Delivery Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add any PO number, delivery notes, or requested revisions..."
                  className="w-full px-4 py-3 text-sm bg-[#F7F7F8] border border-[#E5E7EB] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#171717]"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={responding}
                    onClick={() => handleRespond('accepted')}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold ka-oak-btn rounded-2xl cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Accept Quotation</span>
                  </button>
                  <button
                    type="button"
                    disabled={responding}
                    onClick={() => handleRespond('rejected')}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-[#F3F4F6] text-[#111827] rounded-2xl hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Decline Quotation</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
