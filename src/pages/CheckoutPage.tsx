import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Truck, Banknote, AlertCircle } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { SeoHead } from '../components/SeoHead';

export const CheckoutPage: React.FC = () => {
  const { operatingMode, settings, cart, authFetch, refreshBootstrap, firebaseUser } = usePlatform();
  const currency = settings.general?.currencySymbol || '$';
  const taxRate = Number(settings.commerce?.taxRate || 0);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: firebaseUser?.email || '',
    phone: '',
    companyName: '',
    address1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    customerNotes: '',
  });

  const [couponCode, setCouponCode] = useState(cart.couponCode || '');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [freeShippingCoupon, setFreeShippingCoupon] = useState(false);
  const [couponMsg, setCouponMsg] = useState('');

  const [availableCountries, setAvailableCountries] = useState<string[]>([
    'United States',
    'Canada',
    'Cyprus',
    'Germany',
    'France',
    'United Kingdom',
    'Greece',
  ]);
  const [shippingMethods, setShippingMethods] = useState<any[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  useEffect(() => {
    if (firebaseUser?.email && !form.email) {
      setForm((f) => ({ ...f, email: firebaseUser.email || '' }));
    }
  }, [firebaseUser, form.email]);

  useEffect(() => {
    let active = true;
    fetch('/api/shipping/available', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: form.country,
        region: form.state,
        city: form.city,
        postalCode: form.postalCode,
        subtotal: cart.subtotal,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const list = data.methods || [];
        setShippingMethods(list);
        if (Array.isArray(data.availableCountries) && data.availableCountries.length > 0) {
          setAvailableCountries(data.availableCountries);
        }
        setSelectedShippingId((prev) =>
          list.length === 0 ? null : list.some((m: any) => m.id === prev) ? prev : list[0].id
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [form.country, form.state, form.city, form.postalCode, cart.subtotal]);

  useEffect(() => {
    if (!cart.couponCode) return;
    authFetch('/api/cart/apply-coupon', {
      method: 'POST',
      body: JSON.stringify({ code: cart.couponCode, email: form.email }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setDiscountAmount(d.discountAmount || 0);
          setFreeShippingCoupon(Boolean(d.freeShipping));
          setCouponMsg(`Coupon ${d.couponCode} applied.`);
        }
      })
      .catch(() => {});
  }, [cart.couponCode]);

  if (operatingMode === 'catalogue') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <SeoHead title="Checkout Disabled | Kanso Atelier" noIndex />
        <div className="bg-white rounded-3xl p-10 border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)]">
          <h1 className="text-3xl font-extrabold tracking-tight mb-3 text-[#111827]">
            Catalogue Inquiry Mode Active
          </h1>
          <p className="text-sm text-[#6B7280] mb-6">
            Direct checkout is disabled in Product Catalogue Mode. Please submit your selected products as a quotation inquiry.
          </p>
          <Link to="/inquiry" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold ka-oak-btn rounded-2xl">
            Go to Inquiry Form
          </Link>
        </div>
      </div>
    );
  }

  if (confirmedOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <SeoHead title="Order Confirmed | Kanso Atelier" noIndex />
        <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl p-8 sm:p-10 space-y-6">
          <div className="flex items-center gap-3 text-[#15803D]">
            <CheckCircle2 className="w-7 h-7" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Cash on Delivery Order Confirmed</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
                Order {confirmedOrder.order.orderNumber}
              </h1>
            </div>
          </div>
          <p className="text-sm text-[#4B5563]">
            Thank you, {confirmedOrder.order.customerName}. A confirmation has been dispatched to{' '}
            <strong>{confirmedOrder.order.customerEmail}</strong>. Payment of{' '}
            <strong className="tabular-nums">
              {currency}
              {confirmedOrder.order.totalAmount.toFixed(2)}
            </strong>{' '}
            will be collected upon delivery (Cash on Delivery · Status: Unpaid).
          </p>

          <div className="border-t border-[#F0F1F3] pt-6 space-y-3">
            <h2 className="text-sm font-bold text-[#111827]">Order Items</h2>
            {confirmedOrder.items.map((it: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  {it.productName} {it.variationLabel ? `(${it.variationLabel})` : ''} × {it.quantity}
                </span>
                <span className="font-semibold tabular-nums">
                  {currency}
                  {it.lineTotal.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 flex gap-3">
            <Link to="/shop" className="inline-flex items-center justify-center px-6 py-3 text-xs font-semibold ka-oak-btn rounded-2xl">
              Continue Shopping
            </Link>
            <Link to="/account" className="px-6 py-3 text-xs font-semibold bg-[#F3F4F6] text-[#111827] rounded-2xl">
              View Order History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const chosenShipping = shippingMethods.find((m) => m.id === selectedShippingId);
  const shippingCost = freeShippingCoupon ? 0 : chosenShipping ? chosenShipping.effectivePrice : 0;
  const taxableBase = Math.max(0, cart.subtotal - discountAmount);
  const taxAmount = Math.round(((taxableBase * taxRate) / 100) * 100) / 100;
  const grandTotal = Math.round((taxableBase + taxAmount + shippingCost) * 100) / 100;

  const applyCoupon = async () => {
    setCouponMsg('');
    const res = await authFetch('/api/cart/apply-coupon', {
      method: 'POST',
      body: JSON.stringify({ code: couponCode, email: form.email }),
    });
    const d = await res.json();
    if (!res.ok) {
      setCouponMsg(d.error || 'Coupon invalid');
      setDiscountAmount(0);
      setFreeShippingCoupon(false);
    } else {
      setDiscountAmount(d.discountAmount || 0);
      setFreeShippingCoupon(Boolean(d.freeShipping));
      setCouponMsg(`Applied ${d.couponCode}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await authFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          companyName: form.companyName,
          shippingAddress: {
            firstName: form.firstName,
            lastName: form.lastName,
            company: form.companyName,
            address1: form.address1,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: form.country,
            phone: form.phone,
            email: form.email,
          },
          shippingMethodId: selectedShippingId,
          couponCode,
          customerNotes: form.customerNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Checkout failed.');
      } else {
        setConfirmedOrder(data);
        await refreshBootstrap();
      }
    } catch {
      setError('Network error placing order.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'px-4 py-3 text-sm bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717]';

  return (
    <>
      <SeoHead title="Checkout (Cash on Delivery) | Kanso Atelier" noIndex />
      <div className="ka-container py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] mb-8">Checkout</h1>

        {cart.items.length === 0 ? (
          <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-12 text-center">
            <p className="text-sm text-[#6B7280] mb-5">Your shopping bag is empty.</p>
            <Link to="/shop" className="inline-flex items-center justify-center px-6 py-3 text-xs font-semibold ka-oak-btn rounded-2xl">
              Browse Products
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              {/* Customer & Shipping Info */}
              <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-6 sm:p-7 space-y-4">
                <h2 className="text-base font-bold text-[#111827]">Customer & Delivery Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    required
                    placeholder="First Name *"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    required
                    placeholder="Last Name *"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
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
                    required
                    placeholder="Phone Number *"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <input
                  placeholder="Company / Studio Name (Optional)"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className={`w-full ${inputClass}`}
                />
                <input
                  required
                  placeholder="Street Address *"
                  value={form.address1}
                  onChange={(e) => setForm({ ...form, address1: e.target.value })}
                  className={`w-full ${inputClass}`}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <input
                    required
                    placeholder="City *"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    required
                    placeholder="State / Region"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    required
                    placeholder="Postal Code"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    className={inputClass}
                  />
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className={inputClass}
                  >
                    {(availableCountries.includes(form.country)
                      ? availableCountries
                      : [form.country, ...availableCountries]
                    ).map((countryOption) => (
                      <option key={countryOption} value={countryOption}>
                        {countryOption}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={2}
                  placeholder="Delivery instructions or order notes (Optional)"
                  value={form.customerNotes}
                  onChange={(e) => setForm({ ...form, customerNotes: e.target.value })}
                  className={`w-full ${inputClass}`}
                />
              </div>

              {/* Shipping Methods */}
              <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-6 sm:p-7 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#111827]" />
                    <h2 className="text-base font-bold text-[#111827]">Shipping Method</h2>
                  </div>
                  <span className="text-xs text-[#6B7280]">
                    Rates for {[form.city, form.state, form.country].filter(Boolean).join(', ')}
                  </span>
                </div>
                {shippingMethods.length === 0 ? (
                  <p className="text-xs text-[#6B7280]">
                    No configured shipping rules matched{' '}
                    <strong>{[form.city, form.country].filter(Boolean).join(', ')}</strong>. Standard freight will be arranged.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {shippingMethods.map((m) => {
                      const coverageText =
                        m.zoneName ||
                        (m.effectiveRegions?.length
                          ? m.effectiveRegions.join(', ')
                          : m.effectiveCountries?.length
                          ? m.effectiveCountries.join(', ')
                          : 'Worldwide');
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between gap-4 p-4 border rounded-2xl cursor-pointer transition-colors ${
                            selectedShippingId === m.id
                              ? 'border-[#171717] bg-[#F7F7F8]'
                              : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="radio"
                              name="shippingMethod"
                              checked={selectedShippingId === m.id}
                              onChange={() => setSelectedShippingId(m.id)}
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#111827]">{m.name}</p>
                              <p className="text-xs text-[#6B7280] mt-0.5">
                                {m.estimatedDeliveryTime} · {coverageText}
                                {m.description ? ` · ${m.description}` : ''}
                              </p>
                              {m.freeShippingThreshold && !m.qualifiesFree && (
                                <p className="text-[11px] font-medium text-[#8B5D36] mt-1">
                                  Free shipping on orders over {currency}
                                  {Number(m.freeShippingThreshold).toFixed(0)}
                                </p>
                              )}
                              {m.qualifiesFree && (
                                <p className="text-[11px] font-semibold text-[#15803D] mt-1">
                                  Free shipping threshold unlocked
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-extrabold text-[#111827] tabular-nums shrink-0">
                            {freeShippingCoupon || m.effectivePrice === 0
                              ? 'Free'
                              : `${currency}${Number(m.effectivePrice).toFixed(2)}`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Method: Cash on Delivery Only */}
              <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-6 sm:p-7 space-y-3">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-[#111827]" />
                  <h2 className="text-base font-bold text-[#111827]">Payment Method</h2>
                </div>
                <div className="p-4 border border-[#171717] bg-[#F7F7F8] rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#111827]">Cash on Delivery (COD)</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                      Selected
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1.5">
                    {settings.commerce?.codInstructions ||
                      'Pay in cash or certified check upon courier delivery. Order begins with Unpaid status.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Totals */}
            <div className="lg:col-span-5 bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-6 sm:p-7 space-y-5 lg:sticky lg:top-24">
              <h2 className="text-base font-bold text-[#111827]">Order Summary</h2>
              <div className="divide-y divide-[#F0F1F3] max-h-64 overflow-y-auto">
                {cart.items.map((item) => (
                  <div key={item.id} className="py-3 flex justify-between text-sm gap-4">
                    <div>
                      <p className="font-semibold text-[#111827]">
                        {item.productName} × {item.quantity}
                      </p>
                      {item.variationLabel && (
                        <p className="text-xs text-[#6B7280]">{item.variationLabel}</p>
                      )}
                    </div>
                    <span className="font-bold text-[#111827] tabular-nums">
                      {currency}
                      {(item.lineTotal || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Promo code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 px-3.5 py-2.5 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-mono"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  className="px-4 py-2.5 text-xs font-semibold bg-[#F3F4F6] text-[#111827] rounded-xl hover:bg-[#E5E7EB] cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {couponMsg && <p className="text-xs text-[#15803D] font-medium">{couponMsg}</p>}

              <div className="space-y-2 pt-4 border-t border-[#F0F1F3] text-sm tabular-nums">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Subtotal</span>
                  <span>
                    {currency}
                    {cart.subtotal.toFixed(2)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#15803D] font-medium">
                    <span>Discount</span>
                    <span>
                      -{currency}
                      {discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[#6B7280]">
                  <span>Shipping</span>
                  <span>
                    {shippingCost === 0 ? 'Free' : `${currency}${shippingCost.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Tax ({taxRate}%)</span>
                  <span>
                    {currency}
                    {taxAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-extrabold text-[#111827] pt-3 border-t border-[#F0F1F3]">
                  <span>Total Due on Delivery</span>
                  <span>
                    {currency}
                    {grandTotal.toFixed(2)}
                  </span>
                </div>
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
                {submitting ? 'Confirming Order...' : 'Place Order (Cash on Delivery)'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
};
