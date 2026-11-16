import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, FileText, Star, Check } from 'lucide-react';
import { SafeImage } from './SafeImage';
import { usePlatform } from '../context/PlatformContext';
import { prefetchProduct } from '../lib/prefetch';
import { useWishlist } from '../lib/wishlist';

export interface ProductCardData {
  id: number;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  mainImageUrl: string;
  imageAlt: string;
  productType: string;
  isFeatured: boolean;
  isNew: boolean;
  brand: { id: number; name: string; slug: string } | null;
  categories?: Array<{ id: number; name: string; slug: string }>;
  regularPrice: number | null;
  salePrice: number | null;
  unitPrice: number | null;
  stockQuantity: number | null;
  stockStatus: string;
  inStock: boolean;
  variationCount: number;
  defaultVariationId?: number | null;
  defaultSelectedAttributes?: Array<{
    attributeId: number;
    attributeName: string;
    attributeSlug: string;
    valueId: number;
    value: string;
    colorHex?: string;
  }>;
  flags: {
    operatingMode: 'ecommerce' | 'catalogue';
    showPrices: boolean;
    showSalePrices: boolean;
    showStock: boolean;
    showSku: boolean;
    enableInquiries: boolean;
    enableQuantity: boolean;
    enableQuotations: boolean;
  };
}

export const ProductCard: React.FC<{ product: ProductCardData }> = ({ product }) => {
  const { settings, operatingMode, addToCart } = usePlatform();
  const navigate = useNavigate();
  const { saved, toggle: toggleWishlist } = useWishlist(product.id);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const currency = settings.general?.currencySymbol || '$';
  const isCatalogue = (product.flags?.operatingMode || operatingMode) === 'catalogue';

  const hasSale =
    product.flags.showPrices &&
    product.flags.showSalePrices &&
    product.salePrice !== null &&
    product.regularPrice !== null &&
    product.salePrice < product.regularPrice;

  const discountPct =
    hasSale && product.regularPrice && product.salePrice !== null
      ? Math.max(1, Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100))
      : 0;

  const badgeLabel = product.isFeatured ? 'Best Seller' : product.isNew ? 'New Release' : null;
  const triggerPrefetch = () => prefetchProduct(product.slug, product.mainImageUrl);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.productType === 'variable' && !product.defaultVariationId) {
      navigate(`/products/${product.slug}`);
      return;
    }

    setAdding(true);
    const res = await addToCart({
      productId: product.id,
      variationId: product.productType === 'variable' ? (product.defaultVariationId ?? null) : null,
      quantity: 1,
      selectedAttributes: product.defaultSelectedAttributes || [],
    });
    setAdding(false);

    if (res.ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    } else {
      navigate(`/products/${product.slug}`);
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist();
  };

  const disabledCta = adding || (!isCatalogue && !product.inStock) || (isCatalogue && !product.flags.enableInquiries);

  return (
    <article
      onMouseEnter={triggerPrefetch}
      onFocus={triggerPrefetch}
      onTouchStart={triggerPrefetch}
      className="group flex flex-col bg-white rounded-3xl p-4 border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] hover:shadow-[0_18px_40px_rgba(17,24,39,0.10)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-150 ease-out"
    >
      {/* Rectangular Product Image with Category Card Oak Color Border */}
      <div className="relative aspect-[4/3] w-full rounded-2xl p-[7px] bg-gradient-to-br from-[#CEA173] via-[#B07D4F] to-[#865833] ring-1 ring-inset ring-[#FFF4E4]/55 shadow-[0_12px_20px_rgba(68,42,20,0.14)] group-hover:shadow-[0_16px_26px_rgba(68,42,20,0.20)] transition-shadow duration-200">
        <Link
          to={`/products/${product.slug}`}
          className="relative block w-full h-full rounded-[11px] overflow-hidden bg-gradient-to-br from-[#EFE6DA] to-[#DECBB4] ring-1 ring-[#482C15]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5D36]"
        >
          <SafeImage
            src={product.mainImageUrl}
            alt={product.imageAlt || product.name}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#7C532E]/[0.04] via-transparent to-[#4E3119]/[0.10]"
          />
        </Link>

        {badgeLabel && (
          <span className="pointer-events-none absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-[#F8F3EC]/95 border border-[#DECFC0] text-[#5B3D24] text-xs font-semibold tracking-tight shadow-xs">
            {badgeLabel}
          </span>
        )}

        <button
          type="button"
          onClick={handleWishlist}
          aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name}`}
          aria-pressed={saved}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/95 shadow-[0_2px_10px_rgba(68,42,20,0.16)] flex items-center justify-center text-[#111827] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          <Heart
            className={`w-[18px] h-[18px] transition-colors ${
              saved ? 'fill-[#EF4444] text-[#EF4444]' : 'text-[#111827]'
            }`}
          />
        </button>
      </div>

      {/* Product Details */}
      <div className="pt-4 px-1 pb-0.5 flex-1 flex flex-col">
        <Link
          to={`/products/${product.slug}`}
          className="block focus-visible:outline-none"
        >
          <h3 className="text-[21px] font-bold text-[#111827] tracking-tight leading-snug line-clamp-1">
            {product.name}
          </h3>
          <p className="text-sm text-[#6B7280] line-clamp-1 mt-0.5">
            {product.shortDescription || product.categories?.[0]?.name || 'Home & Office Edition'}
          </p>
        </Link>

        {/* Clean Spec / Stock Line */}
        <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mt-2.5 truncate">
          <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B] shrink-0" />
          <span className="font-semibold text-[#111827] truncate">
            {product.brand?.name || product.categories?.[0]?.name || 'Kanso Atelier'}
          </span>
          <span aria-hidden="true">·</span>
          <span className={!product.inStock && product.flags.showStock ? 'text-red-600 font-medium' : ''}>
            {product.variationCount > 0
              ? `${product.variationCount} Options`
              : product.inStock
              ? 'In Stock'
              : 'Out of Stock'}
          </span>
        </div>

        {/* Price + Discount Row */}
        <div className="mt-3.5 flex items-center flex-wrap gap-2.5 tabular-nums min-h-[2rem]">
          {product.flags.showPrices && product.unitPrice !== null ? (
            <>
              <span className="text-[26px] font-extrabold text-[#111827] tracking-tight leading-none">
                {currency}
                {product.unitPrice.toFixed(2)}
              </span>
              {hasSale && product.regularPrice !== null && (
                <>
                  <span className="text-[17px] text-[#9CA3AF] line-through font-medium">
                    {currency}
                    {product.regularPrice.toFixed(2)}
                  </span>
                  {discountPct > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs font-bold">
                      {discountPct}% OFF
                    </span>
                  )}
                </>
              )}
            </>
          ) : (
            <span className="text-sm font-semibold text-[#374151]">
              {isCatalogue ? 'Request Quotation' : 'Price on Request'}
            </span>
          )}
        </div>

        {/* Full-Width Primary CTA */}
        <button
          type="button"
          disabled={disabledCta}
          onClick={handleQuickAdd}
          className="mt-4 w-full h-12 rounded-2xl ka-oak-btn text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          {added ? (
            <>
              <Check className="w-4 h-4 text-[#F8F3EC]" />
              <span>{isCatalogue ? 'Added to Inquiry' : 'Added to Cart'}</span>
            </>
          ) : isCatalogue ? (
            <>
              <FileText className="w-4 h-4" />
              <span>{adding ? 'Adding...' : 'Add to Inquiry'}</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              <span>{adding ? 'Adding...' : product.inStock ? 'Add to Cart' : 'Out of Stock'}</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
};
