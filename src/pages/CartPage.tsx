import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Trash2, ArrowRight, Tag, Truck } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { SafeImage } from '../components/SafeImage';
import { SeoHead } from '../components/SeoHead';

export const CartPage: React.FC = () => {
  const { operatingMode, settings, cart, updateCartQty, removeCartItem, authFetch, refreshBootstrap } =
    usePlatform();
  const [couponInput, setCouponInput] = useState(cart.couponCode || '');
  const [couponResult, setCouponResult] = useState<{
    valid?: boolean;
    discountAmount?: number;
    freeShipping?: boolean;
    description?: string;
    error?: string;
  } | null>(null);

  const [shipCountry, setShipCountry] = useState('United States');
  const [shipCity, setShipCity] = useState('');
  const [availableCountries, setAvailableCountries] = useState<string[]>([
    'United States',
    'Canada',
    'Cyprus',
    'Germany',
    'France',
    'United Kingdom',
    'Greece',
  ]);
  const [shipMethods, setShipMethods] = useState<any[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | null>(null);

  const currency = settings.general?.currencySymbol || '$';
  const isCatalogue = operatingMode === 'catalogue';
  const taxRate = Number(settings.commerce?.taxRate || 0);

  useEffect(() => {
    if (isCatalogue) return;
    let active = true;
    fetch('/api/shipping/available', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: shipCountry,
        city: shipCity,
        subtotal: cart.subtotal,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const list = data.methods || [];
        setShipMethods(list);
        if (Array.isArray(data.availableCountries) && data.availableCountries.length > 0) {
          setAvailableCountries(data.availableCountries);
        }
        setSelectedShipId((prev) =>
          list.length === 0 ? null : list.some((m: any) => m.id === prev) ? prev : list[0].id
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isCatalogue, shipCountry, shipCity, cart.subtotal]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponResult(null);
    const res = await authFetch('/api/cart/apply-coupon', {
      method: 'POST',
      body: JSON.stringify({ code: couponInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCouponResult({ valid: false, error: data.error || 'Invalid coupon' });
    } else {
      setCouponResult(data);
      await refreshBootstrap();
    }
  };

  const discount = couponResult?.valid ? couponResult.discountAmount || 0 : 0;
  const taxable = Math.max(0, cart.subtotal - discount);
  const chosenShip = shipMethods.find((m) => m.id === selectedShipId) || null;
  const estShipping = isCatalogue
    ? 0
    : couponResult?.freeShipping
    ? 0
    : chosenShip
    ? Number(chosenShip.effectivePrice || 0)
    : 0;
  const estTax = isCatalogue ? 0 : Math.round(((taxable * taxRate) / 100) * 100) / 100;
  const estTotal = Math.round((taxable + estTax + estShipping) * 100) / 100;

  return (
    <>
      <SeoHead
        title={isCatalogue ? 'Inquiry Cart | Kanso Atelier' : 'Shopping Bag | Kanso Atelier'}
        noIndex
      />

      <div className="ka-container py-12">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827]">
              {isCatalogue ? 'Inquiry Cart' : 'Shopping Bag'}
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              {isCatalogue
                ? 'Review your selected pieces and variations before submitting a formal quotation request.'
                : 'Review your items, estimate location-based shipping, and proceed to Cash on Delivery checkout.'}
            </p>
          </div>
          <Link to="/shop" className="text-sm font-semibold text-[#111827] hover:underline whitespace-nowrap">
            Continue Browsing
          </Link>
        </div>

        {cart.items.length === 0 ? (
          <div className="bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-14 text-center">
            <p className="text-sm text-[#6B7280] mb-6">
              {isCatalogue
                ? 'No products have been added to your inquiry cart yet.'
                : 'Your shopping bag is currently empty.'}
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold ka-oak-btn rounded-2xl"
            >
              Explore Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Line Items */}
            <div className="lg:col-span-8 bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl divide-y divide-[#F0F1F3]">
              {cart.items.map((item) => (
                <div key={item.id} className="p-6 flex flex-col sm:flex-row gap-5">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#ECECEE] shrink-0">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          to={`/products/${item.productSlug}`}
                          className="text-base font-bold text-[#111827] hover:underline"
                        >
                          {item.productName}
                        </Link>
                        {item.variationLabel && (
                          <p className="text-xs text-[#6B7280] mt-1">{item.variationLabel}</p>
                        )}
                        {item.showSku && (
                          <p className="text-xs font-mono text-[#9CA3AF] mt-1">SKU: {item.sku}</p>
                        )}
                      </div>
                      {item.showPrices && item.lineTotal !== null && (
                        <span className="text-lg font-extrabold text-[#111827] tabular-nums">
                          {currency}
                          {item.lineTotal.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-5">
                      <div className="inline-flex items-center bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-[#ECECEE] rounded-l-xl cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-4 text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity + 1)}
                          className="p-2 hover:bg-[#ECECEE] rounded-r-xl cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Panel */}
            <div className="lg:col-span-4 bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] rounded-3xl p-6 space-y-5">
              <h2 className="text-base font-bold text-[#111827]">
                {isCatalogue ? 'Inquiry Summary' : 'Order Summary'}
              </h2>

              {!isCatalogue && settings.commerce?.showPrices !== false && (
                <>
                  {/* Shipping Location + Method + Cost Estimator */}
                  <div className="space-y-2.5 pb-4 border-b border-[#F0F1F3]">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]">
                      <Truck className="w-3.5 h-3.5 text-[#8B5D36]" />
                      <span>Estimate Shipping by Location</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={shipCountry}
                        onChange={(e) => setShipCountry(e.target.value)}
                        aria-label="Shipping country"
                        className="px-3 py-2 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717]"
                      >
                        {(availableCountries.includes(shipCountry)
                          ? availableCountries
                          : [shipCountry, ...availableCountries]
                        ).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={shipCity}
                        onChange={(e) => setShipCity(e.target.value)}
                        placeholder="City / Region"
                        aria-label="Shipping city or region"
                        className="px-3 py-2 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717]"
                      />
                    </div>

                    {shipMethods.length === 0 ? (
                      <p className="text-[11px] text-[#6B7280]">
                        No fixed rates matched {shipCity ? `${shipCity}, ` : ''}
                        {shipCountry}. Exact freight confirmed at checkout.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {shipMethods.map((m) => (
                          <label
                            key={m.id}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                              selectedShipId === m.id
                                ? 'border-[#171717] bg-[#F7F7F8]'
                                : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="radio"
                                name="cartShippingEstimator"
                                checked={selectedShipId === m.id}
                                onChange={() => setSelectedShipId(m.id)}
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-[#111827] truncate">{m.name}</p>
                                <p className="text-[11px] text-[#6B7280] truncate">
                                  {m.estimatedDeliveryTime}
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-[#111827] tabular-nums shrink-0">
                              {couponResult?.freeShipping || m.effectivePrice === 0
                                ? 'Free'
                                : `${currency}${Number(m.effectivePrice).toFixed(2)}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleApplyCoupon} className="space-y-2">
                    <label className="block text-xs font-semibold text-[#6B7280]">Coupon Code</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          placeholder="e.g. ATELIER15"
                          className="w-full pl-8 pr-3 py-2 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#171717]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold bg-[#F3F4F6] text-[#111827] rounded-xl hover:bg-[#E5E7EB] cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                    {couponResult?.error && (
                      <p className="text-xs text-red-600">{couponResult.error}</p>
                    )}
                    {couponResult?.valid && (
                      <p className="text-xs font-medium text-[#15803D] bg-[#DCFCE7] px-3 py-1.5 rounded-xl">
                        Applied {cart.couponCode}: {couponResult.description || 'Discount active'}
                      </p>
                    )}
                  </form>

                  <div className="space-y-2.5 pt-4 border-t border-[#F0F1F3] text-sm tabular-nums">
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Subtotal</span>
                      <span>
                        {currency}
                        {cart.subtotal.toFixed(2)}
                      </span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-[#15803D] font-medium">
                        <span>Coupon Discount</span>
                        <span>
                          -{currency}
                          {discount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#6B7280]">
                      <span>
                        Shipping ({chosenShip ? chosenShip.name : shipCountry})
                      </span>
                      <span>
                        {chosenShip || couponResult?.freeShipping
                          ? estShipping === 0
                            ? 'Free'
                            : `${currency}${estShipping.toFixed(2)}`
                          : 'At checkout'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Estimated Tax ({taxRate}%)</span>
                      <span>
                        {currency}
                        {estTax.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-extrabold text-lg text-[#111827] pt-3 border-t border-[#F0F1F3]">
                      <span>Estimated Total</span>
                      <span>
                        {currency}
                        {estTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {isCatalogue && (
                <div className="text-sm text-[#6B7280] space-y-2 pt-2 border-t border-[#F0F1F3]">
                  <div className="flex justify-between tabular-nums">
                    <span>Selected Products</span>
                    <span className="font-bold text-[#111827]">{cart.items.length}</span>
                  </div>
                  <div className="flex justify-between tabular-nums">
                    <span>Total Units</span>
                    <span className="font-bold text-[#111827]">{cart.itemCount}</span>
                  </div>
                  <p className="text-xs text-[#6B7280] pt-2">
                    Submit your consolidated inquiry to receive a formal itemized quotation with volume pricing and freight options.
                  </p>
                </div>
              )}

              <Link
                to={isCatalogue ? '/inquiry' : '/checkout'}
                className="w-full h-12 inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold ka-oak-btn rounded-2xl"
              >
                <span>
                  {isCatalogue ? 'Proceed to Inquiry Submission' : 'Proceed to Checkout'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
