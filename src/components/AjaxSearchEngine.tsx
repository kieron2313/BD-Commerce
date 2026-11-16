import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  ArrowRight,
  Loader2,
  ShoppingCart,
  FileText,
  Check,
  FolderTree,
  Award,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { SafeImage } from './SafeImage';
import { fetchCachedQuery, getCachedQuery, prefetchCatalog, prefetchProduct } from '../lib/prefetch';
import type { ProductCardData } from './ProductCard';

interface InstantSearchResponse {
  query: string;
  totalMatches: number;
  products: ProductCardData[];
  categories: Array<{ id: number; name: string; slug: string; description?: string }>;
  brands: Array<{ id: number; name: string; slug: string }>;
  suggestions: string[];
}

interface AjaxSearchEngineProps {
  variant?: 'hero' | 'modal';
  initialQuery?: string;
  onNavigateDone?: () => void;
  autoFocus?: boolean;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="bg-[#CCF3C6] text-[#14532D] rounded px-0.5 font-bold">{match}</mark>
      {after}
    </>
  );
}

export const AjaxSearchEngine: React.FC<AjaxSearchEngineProps> = ({
  variant = 'hero',
  initialQuery = '',
  onNavigateDone,
  autoFocus = false,
}) => {
  const { categories, settings, operatingMode, addToCart } = usePlatform();
  const navigate = useNavigate();
  const currency = settings.general?.currencySymbol || '$';
  const isCatalogue = operatingMode === 'catalogue';

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [open, setOpen] = useState(variant === 'modal');
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [addedId, setAddedId] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const initialUrl = `/api/search/instant?limit=6`;
  const [results, setResults] = useState<InstantSearchResponse | null>(
    () => getCachedQuery<InstantSearchResponse>(initialUrl)
  );

  // Close dropdown when clicking outside (in hero variant)
  useEffect(() => {
    if (variant === 'modal') return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [variant]);

  // Live AJAX instant search fetch (debounced + cached)
  useEffect(() => {
    const shouldFetch = open || query.trim().length > 0 || selectedCategory !== '';
    if (!shouldFetch) return;

    const qs = new URLSearchParams();
    if (query.trim()) qs.set('q', query.trim());
    if (selectedCategory) qs.set('category', selectedCategory);
    qs.set('limit', variant === 'modal' ? '6' : '8');
    const url = `/api/search/instant?${qs.toString()}`;

    const cached = getCachedQuery<InstantSearchResponse>(url, 30_000);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchCachedQuery<InstantSearchResponse>(url, {
        onRevalidate: (fresh) => {
          if (!cancelled) setResults(fresh);
        },
      })
        .then((data) => {
          if (!cancelled) {
            setResults(data);
            setActiveIndex(-1);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, query.trim() ? 120 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, selectedCategory, open, variant]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (selectedCategory) params.set('category', selectedCategory);

    if (activeIndex >= 0 && results?.products[activeIndex]) {
      const picked = results.products[activeIndex];
      setOpen(false);
      onNavigateDone?.();
      navigate(`/products/${picked.slug}`);
      return;
    }

    setOpen(false);
    onNavigateDone?.();
    navigate(trimmed ? `/search?${params.toString()}` : selectedCategory ? `/categories/${selectedCategory}` : '/shop');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = results?.products.length || 0;
    if (e.key === 'Escape') {
      setOpen(false);
      if (variant === 'modal') onNavigateDone?.();
    } else if (e.key === 'ArrowDown' && count > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev + 1) % count);
    } else if (e.key === 'ArrowUp' && count > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev <= 0 ? count - 1 : prev - 1));
    }
  };

  const handleQuickAdd = async (e: React.MouseEvent, p: ProductCardData) => {
    e.preventDefault();
    e.stopPropagation();
    if (p.productType === 'variable' && !p.defaultVariationId) {
      setOpen(false);
      onNavigateDone?.();
      navigate(`/products/${p.slug}`);
      return;
    }
    setAddingId(p.id);
    const res = await addToCart({
      productId: p.id,
      variationId: p.productType === 'variable' ? (p.defaultVariationId ?? null) : null,
      quantity: 1,
      selectedAttributes: p.defaultSelectedAttributes || [],
    });
    setAddingId(null);
    if (res.ok) {
      setAddedId(p.id);
      window.setTimeout(() => setAddedId(null), 1500);
    }
  };

  const mainCategories = categories.filter((c) => !c.parentId);
  const quickTerms = results?.suggestions?.length
    ? results.suggestions
    : ['Home Furniture', 'Office Furniture', 'Executive Desks', 'Ergonomic Chairs', 'Lounge Seating', 'Credenzas'];

  const showResultsPanel = open || variant === 'modal';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Main Big Search Command Bar */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl p-2 sm:p-2.5 border border-[#E5E7EB] shadow-[0_14px_38px_rgba(17,24,39,0.07)] focus-within:border-[#171717] transition-colors flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
      >
        <div className="flex items-center gap-3 flex-1 px-3 sm:px-4 min-w-0">
          <Search className="w-5 h-5 text-[#111827] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            autoFocus={autoFocus}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search lounge chairs, walnut desks, ergonomic office chairs, oak credenzas, SKUs..."
            aria-label="Search catalog products"
            className="w-full py-2.5 sm:py-3 text-base font-medium text-[#111827] placeholder:text-[#9CA3AF] bg-transparent focus:outline-none min-w-0"
          />
          {loading && <Loader2 className="w-4 h-4 text-[#6B7280] animate-spin shrink-0" />}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="p-1.5 rounded-full bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 px-1 sm:px-0">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setOpen(true);
            }}
            aria-label="Filter search by category"
            className="h-12 px-3.5 rounded-2xl bg-[#F7F7F8] border border-[#EAECEF] text-xs font-semibold text-[#111827] focus:outline-none focus:border-[#171717] cursor-pointer"
          >
            <option value="">All Categories</option>
            {mainCategories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="h-12 px-6 rounded-2xl ka-oak-btn text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Search</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Quick Discovery Filter Bar (Hero Variant) */}
      {variant === 'hero' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-semibold text-[#6B7280] mr-1">Popular searches:</span>
          {quickTerms.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setQuery(term);
                setOpen(true);
                inputRef.current?.focus();
              }}
              className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                query.toLowerCase() === term.toLowerCase()
                  ? 'ka-oak-btn'
                  : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#8B5D36] hover:text-[#111827]'
              }`}
            >
              {term}
            </button>
          ))}
        </div>
      )}

      {/* Live AJAX Instant Results Panel */}
      {showResultsPanel && results && (
        <div
          className={`${
            variant === 'hero'
              ? 'absolute left-0 right-0 top-[calc(100%-22px)] z-40 mt-2'
              : 'mt-4'
          } bg-white rounded-3xl border border-[#EAECEF] shadow-[0_24px_60px_rgba(17,24,39,0.16)] overflow-hidden ka-scale-appear`}
        >
          {/* Matching Categories & Makers Quick Jump */}
          {(results.categories.length > 0 || results.brands.length > 0) && (
            <div className="px-5 py-3.5 bg-[#FAFAFB] border-b border-[#F0F1F3] flex flex-wrap items-center gap-3">
              {results.categories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B7280]">
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>Categories:</span>
                  </span>
                  {results.categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/categories/${cat.slug}`}
                      onMouseEnter={() => prefetchCatalog({ category: cat.slug })}
                      onClick={() => {
                        setOpen(false);
                        onNavigateDone?.();
                      }}
                      className="px-2.5 py-1 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#171717] text-xs font-semibold text-[#111827] transition-colors whitespace-nowrap"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
              {results.brands.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B7280]">
                    <Award className="w-3.5 h-3.5" />
                    <span>Makers:</span>
                  </span>
                  {results.brands.map((b) => (
                    <Link
                      key={b.id}
                      to={`/brands/${b.slug}`}
                      onMouseEnter={() => prefetchCatalog({ brand: b.slug })}
                      onClick={() => {
                        setOpen(false);
                        onNavigateDone?.();
                      }}
                      className="px-2.5 py-1 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#171717] text-xs font-semibold text-[#111827] transition-colors whitespace-nowrap"
                    >
                      {b.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Product Results Grid */}
          <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-[#6B7280]">
                {query.trim()
                  ? `Instant matches for “${query.trim()}” (${results.totalMatches})`
                  : 'Featured & Popular Pieces'}
              </p>
              {variant === 'hero' && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-[#6B7280] hover:text-[#111827] cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>

            {results.products.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-semibold text-[#111827]">
                  No products found for “{query.trim()}”.
                </p>
                <p className="text-xs text-[#6B7280]">
                  Try another material, SKU, finish, or reset the category filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.products.map((p, idx) => {
                  const isHighlighted = idx === activeIndex;
                  const isAdded = addedId === p.id;
                  const isAdding = addingId === p.id;
                  return (
                    <Link
                      key={`${p.id}-${query}-${selectedCategory}`}
                      to={`/products/${p.slug}`}
                      onMouseEnter={() => prefetchProduct(p.slug, p.mainImageUrl)}
                      onClick={() => {
                        setOpen(false);
                        onNavigateDone?.();
                      }}
                      style={{ animationDelay: `${Math.min(idx, 6) * 35}ms` }}
                      className={`ka-appear group flex items-center gap-3.5 p-3 rounded-2xl border transition-all ${
                        isHighlighted
                          ? 'bg-[#F7F7F8] border-[#171717]'
                          : 'bg-white border-[#F0F1F3] hover:border-[#D1D5DB] hover:bg-[#FAFAFB]'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-xl bg-[#ECECEE] overflow-hidden shrink-0">
                        <SafeImage
                          src={p.mainImageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#111827] truncate">
                          {highlightMatch(p.name, query)}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-[#6B7280] truncate mt-0.5">
                          <span>{p.brand?.name || p.categories?.[0]?.name || 'Kanso Atelier'}</span>
                          {p.sku && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{highlightMatch(p.sku, query)}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className={p.inStock ? 'text-[#15803D] font-semibold' : 'text-red-600'}>
                            {p.inStock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                        <div className="mt-1 tabular-nums flex items-center gap-2">
                          {p.flags.showPrices && p.unitPrice !== null ? (
                            <span className="text-sm font-extrabold text-[#111827]">
                              {currency}
                              {p.unitPrice.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-[#4B5563]">
                              {isCatalogue ? 'Request Quote' : 'Price on Request'}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isAdding || (!isCatalogue && !p.inStock)}
                        onClick={(e) => handleQuickAdd(e, p)}
                        title={isCatalogue ? 'Add to Inquiry' : 'Add to Cart'}
                        className="shrink-0 w-10 h-10 rounded-xl ka-oak-btn flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        {isAdded ? (
                          <Check className="w-4 h-4 text-[#F8F3EC]" />
                        ) : isCatalogue ? (
                          <FileText className="w-4 h-4" />
                        ) : (
                          <ShoppingCart className="w-4 h-4" />
                        )}
                      </button>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* View All Footer Bar */}
          {results.totalMatches > 0 && (
            <div className="px-5 py-3.5 bg-[#F7F7F8] border-t border-[#EAECEF] flex items-center justify-between gap-3">
              <span className="text-xs text-[#6B7280] tabular-nums">
                Showing {results.products.length} of {results.totalMatches} products
              </span>
              <Link
                to={
                  query.trim()
                    ? `/search?q=${encodeURIComponent(query.trim())}${
                        selectedCategory ? `&category=${encodeURIComponent(selectedCategory)}` : ''
                      }`
                    : selectedCategory
                    ? `/categories/${selectedCategory}`
                    : '/shop'
                }
                onClick={() => {
                  setOpen(false);
                  onNavigateDone?.();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111827] hover:underline whitespace-nowrap"
              >
                <span>
                  {query.trim() ? `View all ${results.totalMatches} results` : 'Explore full catalog'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
