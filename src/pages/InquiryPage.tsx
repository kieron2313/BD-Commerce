import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { SafeImage } from '../components/SafeImage';
import { SeoHead } from '../components/SeoHead';

export const InquiryPage: React.FC = () => {
  const { cart, settings, authFetch, refreshBootstrap, firebaseUser } = usePlatform();
  const [form, setForm] = useState({
    customerName: firebaseUser?.displayName || '',
    companyName: '',
    email: firebaseUser?.email || '',
    phone: '',
    preferredShippingMethod: 'Standard Insured Courier',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<any>(null);

  useEffect(() => {
    if (firebaseUser) {
      setForm((f) => ({
        ...f,
        customerName: f.customerName || firebaseUser.displayName || '',
        email: f.email || firebaseUser.email || '',
      }));
    }
  }, [firebaseUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await authFetch('/api/inquiries', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit inquiry.');
      } else {
        setSubmitted(data);
        await refreshBootstrap();
      }
    } catch {
      setError('Network error submitting inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <SeoHead title="Inquiry Submitted | Kanso Atelier" noIndex />
        <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl p-8 sm:p-10 space-y-6">
          <div className="flex items-center gap-3 text-[#15803D]">
            <CheckCircle2 className="w-7 h-7" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Quotation Request Received</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
                Inquiry {submitted.inquiry.inquiryRef}
              </h1>
            </div>
          </div>
          <p className="text-sm text-[#4B5563]">{submitted.confirmationMessage}</p>
          <div className="border-t border-[#F0F1F3] pt-5 space-y-2.5">
            <h2 className="text-sm font-bold text-[#111827]">Included Items</h2>
            {submitted.items.map((it: any) => (
              <div key={it.id} className="flex justify-between text-sm">
                <span>
                  {it.productName} {it.variationLabel ? `(${it.variationLabel})` : ''} · SKU {it.sku}
                </span>
                <span className="font-semibold tabular-nums">Qty: {it.quantity}</span>
              </div>
            ))}
          </div>
          <div className="pt-4">
            <Link to="/shop" className="inline-flex items-center justify-center px-6 py-3 text-xs font-semibold ka-oak-btn rounded-2xl">
              Return to Catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    'px-4 py-3 text-sm bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717]';

  return (
    <>
      <SeoHead title="Submit Product Inquiry | Kanso Atelier" noIndex />
      <div className="ka-container py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] mb-2">
          Request Formal Quotation
        </h1>
        <p className="text-sm text-[#6B7280] mb-8">
          Submit your consolidated product inquiry without creating an account. Our team will prepare an itemized quotation.
        </p>

        {cart.items.length === 0 ? (
          <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-12 text-center">
            <p className="text-sm text-[#6B7280] mb-5">Your inquiry cart is currently empty.</p>
            <Link to="/shop" className="inline-flex items-center justify-center px-6 py-3 text-xs font-semibold ka-oak-btn rounded-2xl">
              Browse Products
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-6 sm:p-7 space-y-4">
              <h2 className="text-base font-bold text-[#111827]">Contact & Project Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  required
                  placeholder="Full Name *"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className={inputClass}
                />
                <input
                  placeholder="Company / Studio Name"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className={inputClass}
                />
                <input
                  required
                  type="email"
                  placeholder="Email Address *"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
                <input
                  placeholder="Phone Number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                />
              </div>

              {settings.catalogue?.collectShippingPreference !== false && (
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">
                    Preferred Delivery / Freight Preference
                  </label>
                  <select
                    value={form.preferredShippingMethod}
                    onChange={(e) => setForm({ ...form, preferredShippingMethod: e.target.value })}
                    className={`w-full ${inputClass}`}
                  >
                    <option value="Standard Insured Courier">Standard Insured Courier</option>
                    <option value="Express Priority Air">Express Priority Air</option>
                    <option value="White-Glove Commercial Freight">White-Glove Commercial Freight</option>
                    <option value="Studio Pickup">San Francisco Studio Pickup</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">
                  Project Timeline, Finishes or Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Tell us about your project schedule, delivery destination, or custom specification requirements..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className={`w-full ${inputClass}`}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 p-3.5 rounded-2xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 px-6 text-sm font-semibold ka-oak-btn rounded-2xl disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Submitting Inquiry...' : 'Submit Inquiry Request'}
              </button>
            </div>

            <div className="lg:col-span-5 bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-6 sm:p-7 space-y-4">
              <h2 className="text-base font-bold text-[#111827]">
                Inquiry Items ({cart.itemCount} units)
              </h2>
              <div className="divide-y divide-[#F0F1F3]">
                {cart.items.map((item) => (
                  <div key={item.id} className="py-3 flex gap-3 items-center">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#ECECEE] shrink-0">
                      <SafeImage src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#111827] truncate">{item.productName}</p>
                      {item.variationLabel && (
                        <p className="text-xs text-[#6B7280]">{item.variationLabel}</p>
                      )}
                      <p className="text-[11px] font-mono text-[#9CA3AF]">SKU: {item.sku}</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#111827] tabular-nums">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  );
};
