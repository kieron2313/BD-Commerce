import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Minus, Check, AlertCircle, ShoppingCart, FileText, Heart, Star } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { SafeImage } from '../components/SafeImage';
import { ProductCard } from '../components/ProductCard';
import { SeoHead } from '../components/SeoHead';
import { fetchCachedQuery, getCachedQuery, prefetchImage } from '../lib/prefetch';
import { useWishlist } from '../lib/wishlist';

interface VariationOption {
  id: number;
  sku: string;
  regularPrice: number | null;
  salePrice: number | null;
  unitPrice: number | null;
  stockQuantity: number | null;
  stockStatus: string;
  backorderStatus: string;
  imageUrl: string;
  galleryImages: string[];
  weight: number;
  dimensions: { length: number; width: number; height: number; unit: string };
  attributes: Array<{
    attributeId: number;
    attributeName: string;
    attributeSlug: string;
    valueId: number;
    value: string;
    colorHex?: string;
  }>;
}

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { operatingMode, settings, addToCart } = usePlatform();

  const productUrl = slug ? `/api/products/${slug}` : '';
  const initialCached = productUrl ? getCachedQuery<any>(productUrl) : null;

  const [data, setData] = useState<any>(() => initialCached);
  const [loading, setLoading] = useState(() => !initialCached);
  const [notFound, setNotFound] = useState(false);

  const [selectedValues, setSelectedValues] = useState<Record<number, number>>(() => {
    if (!initialCached?.product || initialCached.product.productType !== 'variable' || !initialCached.variations?.length) {
      return {};
    }
    const firstVar =
      initialCached.variations.find((v: VariationOption) => (v.stockQuantity ?? 1) > 0) ||
      initialCached.variations[0];
    const initMap: Record<number, number> = {};
    for (const a of firstVar.attributes || []) initMap[a.attributeId] = a.valueId;
    return initMap;
  });
  const [activeImage, setActiveImage] = useState<string>(() => initialCached?.product?.mainImageUrl || '');
  const [quantity, setQuantity] = useState<number>(() => initialCached?.product?.minOrderQty || 1);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

  const currency = settings.general?.currencySymbol || '$';
  const wishlist = useWishlist(data?.product?.id || 0);

  const applyProductPayload = (res: any) => {
    setData(res);
    setActiveImage(res.product.mainImageUrl || '');
    setQuantity(res.product.minOrderQty || 1);

    if (res.product.productType === 'variable' && res.variations?.length > 0) {
      const firstVar =
        res.variations.find((v: VariationOption) => (v.stockQuantity ?? 1) > 0) ||
        res.variations[0];
      const initMap: Record<number, number> = {};
      for (const a of firstVar.attributes || []) {
        initMap[a.attributeId] = a.valueId;
      }
      setSelectedValues(initMap);
      if (firstVar.imageUrl) setActiveImage(firstVar.imageUrl);
    } else {
      setSelectedValues({});
    }

    (res.variations || []).forEach((v: VariationOption) => prefetchImage(v.imageUrl));
    (res.product?.galleryImages || []).forEach((img: string) => prefetchImage(img));
  };

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const url = `/api/products/${slug}`;
    const cached = getCachedQuery<any>(url);
    setNotFound(false);
    setFeedback(null);

    if (cached) {
      applyProductPayload(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchCachedQuery<any>(url, {
      onRevalidate: (fresh) => {
        if (active && fresh) setData(fresh);
      },
    })
      .then((res) => {
        if (!active || !res) return;
        if (!cached) applyProductPayload(res);
      })
      .catch((err) => {
        if (!active) return;
        if (err?.status === 404 || err?.message === 'NOT_FOUND') setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug, operatingMode]);

  const variations: VariationOption[] = data?.variations || [];
  const variationAttrs = (data?.attributes || []).filter((a: any) => a.usedForVariations);

  const matchedVariation = useMemo(() => {
    if (!data || data.product.productType !== 'variable' || variations.length === 0) return null;
    if (Object.keys(selectedValues).length < variationAttrs.length) return null;
    return (
      variations.find((v) =>
        variationAttrs.every((attr: any) =>
          v.attributes.some(
            (va) => va.attributeId === attr.id && va.valueId === selectedValues[attr.id]
          )
        )
      ) || null
    );
  }, [data, variations, variationAttrs, selectedValues]);

  useEffect(() => {
    if (matchedVariation?.imageUrl) {
      setActiveImage(matchedVariation.imageUrl);
    } else if (data?.product?.mainImageUrl) {
      setActiveImage(data.product.mainImageUrl);
    }
  }, [matchedVariation, data]);

  const isValueValid = (attrId: number, valueId: number): boolean => {
    if (variations.length === 0) return true;
    return variations.some((v) => {
      const hasCandidate = v.attributes.some(
        (va) => va.attributeId === attrId && va.valueId === valueId
      );
      if (!hasCandidate) return false;
      for (const [otherAttrIdStr, otherValId] of Object.entries(selectedValues)) {
        const otherAttrId = Number(otherAttrIdStr);
        if (otherAttrId === attrId) continue;
        const matchesOther = v.attributes.some(
          (va) => va.attributeId === otherAttrId && va.valueId === otherValId
        );
        if (!matchesOther) return false;
      }
      return true;
    });
  };

  if (loading) {
    return (
      <div className="ka-container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 aspect-[4/3] bg-[#ECECEE] rounded-3xl animate-pulse" />
          <div className="lg:col-span-5 bg-white rounded-3xl p-8 space-y-4">
            <div className="h-8 bg-[#ECECEE] rounded-xl w-3/4 animate-pulse" />
            <div className="h-6 bg-[#ECECEE] rounded-xl w-1/3 animate-pulse" />
            <div className="h-32 bg-[#ECECEE] rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <SeoHead title="Product Not Found | Kanso Atelier" noIndex />
        <div className="bg-white rounded-3xl p-10 border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)]">
          <h1 className="text-3xl font-extrabold tracking-tight mb-3 text-[#111827]">Object Not Found</h1>
          <p className="text-sm text-[#6B7280] mb-8">
            This piece may have been archived or moved to a new collection.
          </p>
          <Link to="/shop" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold ka-oak-btn rounded-2xl">
            Return to Collection
          </Link>
        </div>
      </div>
    );
  }

  const prod = data.product;
  const flags = prod.flags;
  const gallery = [...new Set([prod.mainImageUrl, ...(prod.galleryImages || []), ...variations.map((v) => v.imageUrl)].filter(Boolean))];

  const displayPrice = matchedVariation ? matchedVariation.unitPrice : prod.unitPrice;
  const displayRegular = matchedVariation ? matchedVariation.regularPrice : prod.regularPrice;
  const displaySale = matchedVariation ? matchedVariation.salePrice : prod.salePrice;
  const displaySku = matchedVariation ? matchedVariation.sku : prod.sku;
  const displayStockQty = matchedVariation ? matchedVariation.stockQuantity : prod.stockQuantity;
  const displayStockStatus = matchedVariation ? matchedVariation.stockStatus : prod.stockStatus;
  const isAvailable =
    prod.productType === 'variable'
      ? Boolean(
          matchedVariation &&
            (matchedVariation.stockStatus !== 'out_of_stock' || matchedVariation.backorderStatus !== 'no')
        )
      : prod.stockStatus !== 'out_of_stock' || prod.allowBackorder;

  const hasSale =
    flags.showPrices &&
    flags.showSalePrices &&
    displaySale !== null &&
    displayRegular !== null &&
    displaySale < displayRegular;
  const discountPct =
    hasSale && displayRegular && displaySale !== null
      ? Math.max(1, Math.round(((displayRegular - displaySale) / displayRegular) * 100))
      : 0;

  const isCatalogue = operatingMode === 'catalogue';
  const badgeLabel = prod.isFeatured ? 'Best Seller' : prod.isNew ? 'New Release' : null;

  const handlePrimaryAction = async () => {
    setFeedback(null);
    if (prod.productType === 'variable' && !matchedVariation) {
      setFeedback({ type: 'error', msg: 'Please select a valid option combination.' });
      return;
    }
    setAdding(true);
    const res = await addToCart({
      productId: prod.id,
      variationId: matchedVariation?.id || null,
      quantity,
      selectedAttributes: matchedVariation?.attributes || [],
    });
    setAdding(false);
    if (!res.ok) {
      setFeedback({ type: 'error', msg: res.error || 'Unable to add item.' });
    } else {
      setFeedback({
        type: 'success',
        msg: isCatalogue ? 'Added to your inquiry cart.' : 'Added to your shopping bag.',
      });
    }
  };

  const jsonLd: Array<Record<string, unknown>> = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: prod.name,
      image: prod.mainImageUrl,
      description: prod.shortDescription,
      sku: displaySku || undefined,
      brand: prod.brand ? { '@type': 'Brand', name: prod.brand.name } : undefined,
      ...(flags.showPrices && displayPrice !== null
        ? {
            offers: {
              '@type': 'Offer',
              priceCurrency: settings.general?.currency || 'USD',
              price: displayPrice,
              availability: isAvailable
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              url: window.location.href,
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: (data.breadcrumbs || []).map((b: any, idx: number) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: b.name,
        item: window.location.origin + b.path,
      })),
    },
  ];

  return (
    <>
      <SeoHead
        title={prod.seoTitle || `${prod.name} | Kanso Atelier`}
        description={prod.metaDescription || prod.shortDescription}
        canonicalPath={prod.canonicalUrl || `/products/${prod.slug}`}
        ogImage={prod.mainImageUrl}
        jsonLd={jsonLd}
      />

      <div className="ka-container py-10">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-[#6B7280] mb-8 flex flex-wrap items-center gap-2">
          <Link to="/" className="hover:text-[#111827]">
            Home
          </Link>
          {(data.breadcrumbs || []).map((b: any, idx: number) => (
            <React.Fragment key={b.path}>
              <span>/</span>
              {idx === data.breadcrumbs.length - 1 ? (
                <span className="text-[#111827] font-semibold">{b.name}</span>
              ) : (
                <Link to={b.path} className="hover:text-[#111827]">
                  {b.name}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Contiguous Two-Column PDP */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: Gallery */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-4 sm:p-5 border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] space-y-4">
            <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-[#ECECEE]">
              <SafeImage
                src={activeImage}
                alt={prod.imageAlt || prod.name}
                priority
                className="w-full h-full object-cover"
              />
              {badgeLabel && (
                <span className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-[#CCF3C6] text-[#14532D] text-xs font-semibold">
                  {badgeLabel}
                </span>
              )}
              <button
                type="button"
                onClick={wishlist.toggle}
                aria-label={wishlist.saved ? 'Remove from saved' : 'Save item'}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
              >
                <Heart
                  className={`w-5 h-5 ${wishlist.saved ? 'fill-[#EF4444] text-[#EF4444]' : 'text-[#111827]'}`}
                />
              </button>
            </div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {gallery.map((imgUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(imgUrl)}
                    className={`aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all bg-[#ECECEE] cursor-pointer ${
                      activeImage === imgUrl
                        ? 'border-[#8B5D36] shadow-sm'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <SafeImage src={imgUrl} alt={`${prod.name} view ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Sticky Purchase / Inquiry Module */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-2">
                <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                {prod.brand && (
                  <Link to={`/brands/${prod.brand.slug}`} className="hover:underline font-semibold text-[#111827]">
                    {prod.brand.name}
                  </Link>
                )}
                {flags.showSku && displaySku && (
                  <>
                    {prod.brand && <span aria-hidden="true">·</span>}
                    <span className="font-mono">SKU: {displaySku}</span>
                  </>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] leading-tight">
                {prod.name}
              </h1>

              {/* Dynamic Price */}
              <div className="mt-4">
                {flags.showPrices && displayPrice !== null ? (
                  <div className="flex items-center flex-wrap gap-3 tabular-nums">
                    <span className="text-3xl font-extrabold text-[#111827]">
                      {currency}
                      {displayPrice.toFixed(2)}
                    </span>
                    {hasSale && displayRegular !== null && (
                      <>
                        <span className="text-lg text-[#9CA3AF] line-through font-medium">
                          {currency}
                          {displayRegular.toFixed(2)}
                        </span>
                        {discountPct > 0 && (
                          <span className="px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs font-bold">
                            {discountPct}% OFF
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-[#15803D]">
                    {isCatalogue ? 'Available for Custom Trade Quotation' : 'Price on Request'}
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm text-[#6B7280] leading-relaxed">{prod.shortDescription}</p>

            {/* Variation Selectors */}
            {variationAttrs.length > 0 && (
              <div className="space-y-5 pt-5 border-t border-[#F0F1F3]">
                {variationAttrs.map((attr: any) => {
                  const currentValId = selectedValues[attr.id];
                  const currentValObj = attr.values.find((v: any) => v.id === currentValId);
                  return (
                    <div key={attr.id}>
                      <div className="flex items-center justify-between text-xs mb-2.5">
                        <span className="font-bold text-[#111827]">{attr.name}</span>
                        <span className="text-[#6B7280] font-medium">{currentValObj?.value || 'Select'}</span>
                      </div>

                      {attr.displayType === 'swatch' ? (
                        <div className="flex flex-wrap gap-3">
                          {attr.values.map((val: any) => {
                            const selected = currentValId === val.id;
                            const valid = isValueValid(attr.id, val.id);
                            return (
                              <button
                                key={val.id}
                                type="button"
                                disabled={!valid}
                                onClick={() =>
                                  setSelectedValues((prev) => ({ ...prev, [attr.id]: val.id }))
                                }
                                title={val.value}
                                aria-label={`${attr.name}: ${val.value}`}
                                className={`relative w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${
                                  selected
                                    ? 'border-[#734926] ring-2 ring-[#8B5D36] ring-offset-2'
                                    : 'border-[#E5E7EB]'
                                } ${!valid ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                                style={{ backgroundColor: val.colorHex || '#E5E5E5' }}
                              >
                                {selected && (
                                  <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : attr.displayType === 'dropdown' ? (
                        <select
                          value={currentValId || ''}
                          onChange={(e) =>
                            setSelectedValues((prev) => ({
                              ...prev,
                              [attr.id]: Number(e.target.value),
                            }))
                          }
                          className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-2xl bg-[#F7F7F8]"
                        >
                          {attr.values.map((val: any) => (
                            <option
                              key={val.id}
                              value={val.id}
                              disabled={!isValueValid(attr.id, val.id)}
                            >
                              {val.value}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {attr.values.map((val: any) => {
                            const selected = currentValId === val.id;
                            const valid = isValueValid(attr.id, val.id);
                            return (
                              <button
                                key={val.id}
                                type="button"
                                disabled={!valid}
                                onClick={() =>
                                  setSelectedValues((prev) => ({ ...prev, [attr.id]: val.id }))
                                }
                                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                                  selected
                                    ? 'ka-oak-btn'
                                    : 'bg-[#F7F7F8] text-[#111827] border-[#E5E7EB] hover:border-[#8B5D36]'
                                } ${!valid ? 'opacity-30 line-through cursor-not-allowed' : ''}`}
                              >
                                {val.value}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stock Visibility */}
            {flags.showStock && (
              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-[#6B7280] font-medium">Availability</span>
                <span
                  className={`font-semibold px-2.5 py-1 rounded-full tabular-nums ${
                    isAvailable ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {isAvailable
                    ? displayStockQty !== null
                      ? `In Stock (${displayStockQty} units ready)`
                      : 'In Stock'
                    : displayStockStatus === 'on_backorder'
                    ? 'Available on Backorder'
                    : 'Out of Stock'}
                </span>
              </div>
            )}

            {/* Quantity & Primary CTA */}
            <div className="pt-5 border-t border-[#F0F1F3] space-y-3">
              <div className="flex items-center gap-3">
                {flags.enableQuantity && (
                  <div className="inline-flex items-center bg-[#F7F7F8] border border-[#E5E7EB] rounded-2xl h-12">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(prod.minOrderQty || 1, q - 1))}
                      className="px-3.5 h-full hover:bg-[#ECECEE] text-[#111827] rounded-l-2xl cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={prod.minOrderQty || 1}
                      max={prod.maxOrderQty || 999}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-12 text-center text-sm font-bold tabular-nums bg-transparent focus:outline-none"
                      aria-label="Quantity"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="px-3.5 h-full hover:bg-[#ECECEE] text-[#111827] rounded-r-2xl cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={adding || (!isCatalogue && !isAvailable) || (isCatalogue && !flags.enableInquiries)}
                  onClick={handlePrimaryAction}
                  className="flex-1 h-12 inline-flex items-center justify-center gap-2 px-6 text-sm font-semibold ka-oak-btn rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {isCatalogue ? (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>{adding ? 'Adding...' : 'Add to Inquiry'}</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      <span>{adding ? 'Adding...' : isAvailable ? 'Add to Cart' : 'Out of Stock'}</span>
                    </>
                  )}
                </button>
              </div>

              {feedback && (
                <div
                  className={`flex items-center gap-2 text-xs font-medium p-3.5 rounded-2xl border ${
                    feedback.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-[#DCFCE7] border-[#BBF7D0] text-[#15803D]'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feedback.msg}</span>
                </div>
              )}

              {!isCatalogue && settings.commerce?.codEnabled && (
                <p className="text-xs text-[#6B7280] text-center">
                  Cash on Delivery supported · Tracked insured courier
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Full Description & Technical Specifications */}
        <div className="mt-12 bg-white rounded-3xl p-7 sm:p-10 border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#111827] mb-4">
              Design & Materials
            </h2>
            <div className="text-sm text-[#4B5563] leading-relaxed whitespace-pre-line">
              {prod.fullDescription || prod.shortDescription}
            </div>
          </div>

          <div className="lg:col-span-5">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#111827] mb-4">
              Technical Specifications
            </h2>
            <dl className="divide-y divide-[#F0F1F3] border-y border-[#F0F1F3] text-sm">
              {(prod.specifications || []).map((spec: any, i: number) => (
                <div key={i} className="py-3 flex justify-between gap-4">
                  <dt className="text-[#6B7280]">{spec.label}</dt>
                  <dd className="font-semibold text-[#111827] text-right">{spec.value}</dd>
                </div>
              ))}
              {prod.weight > 0 && (
                <div className="py-3 flex justify-between gap-4">
                  <dt className="text-[#6B7280]">Weight</dt>
                  <dd className="font-semibold text-[#111827] tabular-nums">{prod.weight} kg</dd>
                </div>
              )}
              {prod.dimensions?.length > 0 && (
                <div className="py-3 flex justify-between gap-4">
                  <dt className="text-[#6B7280]">Dimensions</dt>
                  <dd className="font-semibold text-[#111827] tabular-nums">
                    {prod.dimensions.length} × {prod.dimensions.width} × {prod.dimensions.height}{' '}
                    {prod.dimensions.unit || 'cm'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Related Products */}
        {data.relatedProducts?.length > 0 && (
          <div className="mt-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827] mb-7">
              Companion Pieces
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {data.relatedProducts.map((rp: any) => (
                <ProductCard key={rp.id} product={rp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
