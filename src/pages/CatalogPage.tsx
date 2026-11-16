import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown, Loader2 } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { ProductCard, ProductCardData } from '../components/ProductCard';
import { AjaxSearchEngine } from '../components/AjaxSearchEngine';
import { SeoHead } from '../components/SeoHead';
import { fetchCachedQuery, getCachedQuery, prefetchCatalog } from '../lib/prefetch';

interface CategoryTreeNode {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  displayLayout?: string;
  productCount?: number;
  depth?: number;
}

export const CatalogPage: React.FC<{ mode?: 'shop' | 'category' | 'brand' | 'search' }> = ({
  mode = 'shop',
}) => {
  const { slug, subslug } = useParams<{ slug?: string; subslug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { categories, brands, attributes, operatingMode, settings } = usePlatform();

  const activeCategorySlug =
    subslug || (mode === 'category' ? slug : '') || searchParams.get('category') || '';
  const activeBrandSlug = (mode === 'brand' ? slug : '') || searchParams.get('brand') || '';
  const activeSearch = searchParams.get('q') || '';
  const activeSort = searchParams.get('sort') || 'featured';
  const activeAvail = searchParams.get('availability') || '';
  const activeMinPrice = searchParams.get('minPrice') || '';
  const activeMaxPrice = searchParams.get('maxPrice') || '';
  const activePage = Number(searchParams.get('page') || 1);
  const selectedAttrVals = useMemo(() => {
    const raw = searchParams.get('attrs') || '';
    return raw
      .split(',')
      .map(Number)
      .filter((n) => !Number.isNaN(n) && n > 0);
  }, [searchParams]);

  // AJAX category tree & expanded main category state
  const [treeCategories, setTreeCategories] = useState<CategoryTreeNode[]>([]);
  const [totalCatalogCount, setTotalCatalogCount] = useState<number | null>(null);
  const [expandedParentIds, setExpandedParentIds] = useState<number[]>([]);
  const [ajaxSubcatsByParent, setAjaxSubcatsByParent] = useState<Record<number, CategoryTreeNode[]>>({});
  const [loadingSubcatParentId, setLoadingSubcatParentId] = useState<number | null>(null);

  const effectiveCategories: CategoryTreeNode[] =
    treeCategories.length > 0 ? treeCategories : categories;

  const queryUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (activeSearch) qs.set('q', activeSearch);
    if (activeCategorySlug) qs.set('category', activeCategorySlug);
    if (activeBrandSlug) qs.set('brand', activeBrandSlug);
    if (selectedAttrVals.length > 0) qs.set('attrs', selectedAttrVals.join(','));
    if (activeAvail) qs.set('availability', activeAvail);
    if (activeMinPrice) qs.set('minPrice', activeMinPrice);
    if (activeMaxPrice) qs.set('maxPrice', activeMaxPrice);
    qs.set('sort', activeSort);
    qs.set('page', String(activePage));
    qs.set('limit', '12');
    return `/api/products?${qs.toString()}`;
  }, [
    activeSearch,
    activeCategorySlug,
    activeBrandSlug,
    selectedAttrVals,
    activeAvail,
    activeMinPrice,
    activeMaxPrice,
    activeSort,
    activePage,
  ]);

  const initialCached = getCachedQuery<{ products: ProductCardData[]; pagination: any }>(queryUrl);
  const [products, setProducts] = useState<ProductCardData[]>(() => initialCached?.products || []);
  const [pagination, setPagination] = useState(
    () => initialCached?.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 }
  );
  const [loading, setLoading] = useState(() => !initialCached);
  const [updatingAjax, setUpdatingAjax] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const currentCategory = effectiveCategories.find((c) => c.slug === activeCategorySlug);
  const parentCategory = currentCategory?.parentId
    ? effectiveCategories.find((c) => c.id === currentCategory.parentId)
    : null;
  const subcategories = currentCategory
    ? effectiveCategories.filter((c) => c.parentId === currentCategory.id)
    : [];
  const currentBrand = brands.find((b) => b.slug === activeBrandSlug);

  // Load live category tree with counts via AJAX
  useEffect(() => {
    let active = true;
    fetchCachedQuery<{ categories: CategoryTreeNode[]; totalProducts: number }>('/api/categories/tree')
      .then((data) => {
        if (!active) return;
        setTreeCategories(data.categories || []);
        if (typeof data.totalProducts === 'number') {
          setTotalCatalogCount(data.totalProducts);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [operatingMode]);

  // Helper to get top-level root ancestor ID for any category
  const getRootParentId = (cat?: CategoryTreeNode | null): number | null => {
    if (!cat) return null;
    let cursor: CategoryTreeNode | undefined = cat;
    const seen = new Set<number>();
    while (cursor?.parentId && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      const next = effectiveCategories.find((c) => c.id === cursor!.parentId);
      if (!next) break;
      cursor = next;
    }
    return cursor?.id ?? null;
  };

  // Fetch all subcategories for a parent category via AJAX and open it
  const loadSubcategoriesAjax = async (parent: CategoryTreeNode) => {
    setExpandedParentIds((prev) => (prev.includes(parent.id) ? prev : [...prev, parent.id]));

    if (ajaxSubcatsByParent[parent.id]) {
      return;
    }

    const endpoint = `/api/categories/${parent.slug}/subcategories`;
    const cached = getCachedQuery<{ subcategories: CategoryTreeNode[] }>(endpoint);
    if (cached) {
      setAjaxSubcatsByParent((prev) => ({ ...prev, [parent.id]: cached.subcategories || [] }));
      return;
    }

    setLoadingSubcatParentId(parent.id);
    try {
      const data = await fetchCachedQuery<{ subcategories: CategoryTreeNode[] }>(endpoint);
      setAjaxSubcatsByParent((prev) => ({ ...prev, [parent.id]: data.subcategories || [] }));
    } catch {
      // Fallback safely to preloaded categories
    } finally {
      setLoadingSubcatParentId((curr) => (curr === parent.id ? null : curr));
    }
  };

  // Automatically expand active main category (and load its subcategories via AJAX) on route load
  useEffect(() => {
    if (!currentCategory) return;
    const rootId = getRootParentId(currentCategory);
    if (!rootId) return;
    const rootCat = effectiveCategories.find((c) => c.id === rootId);
    if (rootCat) {
      void loadSubcategoriesAjax(rootCat);
    }
  }, [currentCategory?.id, effectiveCategories.length]);

  // AJAX product query
  useEffect(() => {
    let active = true;
    const cached = getCachedQuery<{ products: ProductCardData[]; pagination: any }>(queryUrl);
    if (cached) {
      setProducts(cached.products || []);
      setPagination(cached.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
      setLoading(false);
      setUpdatingAjax(false);
    } else if (products.length > 0) {
      // Keep current grid mounted during AJAX transition instead of blanking with skeletons
      setUpdatingAjax(true);
    } else {
      setLoading(true);
    }

    fetchCachedQuery<{ products: ProductCardData[]; pagination: any }>(queryUrl, {
      onRevalidate: (fresh) => {
        if (!active) return;
        setProducts(fresh.products || []);
        setPagination(fresh.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
      },
    })
      .then((data) => {
        if (!active) return;
        setProducts(data.products || []);
        setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
      })
      .catch((err) => console.error('Catalog fetch error:', err))
      .finally(() => {
        if (active) {
          setLoading(false);
          setUpdatingAjax(false);
        }
      });

    return () => {
      active = false;
    };
  }, [queryUrl, operatingMode]);

  const buildFilterQueryString = (resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    next.delete('category');
    if (resetPage) next.delete('page');
    const str = next.toString();
    return str ? `?${str}` : '';
  };

  const handleSelectAllProductsAjax = () => {
    navigate(`/shop${buildFilterQueryString(true)}`, { state: { ajaxCatalog: true } });
  };

  const handleSelectMainCategoryAjax = (parent: CategoryTreeNode) => {
    // Always open all subcategories when clicking the main category
    void loadSubcategoriesAjax(parent);
    navigate(`/categories/${parent.slug}${buildFilterQueryString(true)}`, {
      state: { ajaxCatalog: true },
    });
  };

  const handleToggleParentOnly = (e: React.MouseEvent, parent: CategoryTreeNode) => {
    e.stopPropagation();
    const isExpanded = expandedParentIds.includes(parent.id);
    if (isExpanded) {
      setExpandedParentIds((prev) => prev.filter((id) => id !== parent.id));
    } else {
      void loadSubcategoriesAjax(parent);
    }
  };

  const handleSelectSubcategoryAjax = (parent: CategoryTreeNode, sub: CategoryTreeNode) => {
    setExpandedParentIds((prev) => (prev.includes(parent.id) ? prev : [...prev, parent.id]));
    navigate(`/categories/${parent.slug}/${sub.slug}${buildFilterQueryString(true)}`, {
      state: { ajaxCatalog: true },
    });
  };

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const toggleAttrFilter = (valId: number) => {
    const exists = selectedAttrVals.includes(valId);
    const nextVals = exists
      ? selectedAttrVals.filter((id) => id !== valId)
      : [...selectedAttrVals, valId];
    updateParam('attrs', nextVals.join(','));
  };

  const showPriceFilter =
    operatingMode === 'ecommerce'
      ? settings.commerce?.showPrices !== false
      : settings.catalogue?.showPricesInCatalogue === true;

  const pageTitle = currentCategory
    ? currentCategory.seoTitle || `${currentCategory.name} | Kanso Atelier`
    : currentBrand
    ? currentBrand.seoTitle || `${currentBrand.name} | Kanso Atelier`
    : activeSearch
    ? `Search: "${activeSearch}" | Kanso Atelier`
    : 'All Products | Kanso Atelier';

  const canonicalPath = currentCategory
    ? parentCategory
      ? `/categories/${parentCategory.slug}/${currentCategory.slug}`
      : `/categories/${currentCategory.slug}`
    : currentBrand
    ? `/brands/${currentBrand.slug}`
    : '/shop';

  const hasFilters = Boolean(
    searchParams.get('attrs') ||
      searchParams.get('sort') ||
      searchParams.get('minPrice') ||
      searchParams.get('maxPrice') ||
      searchParams.get('availability') ||
      mode === 'search'
  );

  // Collect local fallback descendants recursively if AJAX response hasn't returned yet
  const getDescendantsForParent = (parentId: number): CategoryTreeNode[] => {
    if (ajaxSubcatsByParent[parentId]) {
      return ajaxSubcatsByParent[parentId];
    }
    const result: CategoryTreeNode[] = [];
    const walk = (pid: number, depth: number) => {
      const kids = effectiveCategories.filter((c) => c.parentId === pid);
      for (const k of kids) {
        result.push({ ...k, depth });
        walk(k.id, depth + 1);
      }
    };
    walk(parentId, 0);
    return result;
  };

  const mainCategories = effectiveCategories.filter((c) => !c.parentId);

  const FilterPanel = (
    <div className="bg-white rounded-3xl p-6 border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.05)] space-y-7">
      {/* AJAX Categories Accordion Menu */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Categories</h3>
          {updatingAjax && (
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#6B7280]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Updating</span>
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {/* All Products Option */}
          <button
            type="button"
            onClick={handleSelectAllProductsAjax}
            onMouseEnter={() => prefetchCatalog()}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer ${
              !activeCategorySlug
                ? 'ka-oak-btn font-bold'
                : 'border-[#E5E7EB] bg-[#FAFAFB] text-[#111827] font-bold hover:border-[#C5A482] hover:bg-white'
            }`}
          >
            <span className="text-[15.5px]">All Products</span>
            {totalCatalogCount !== null && (
              <span
                className={`text-[13px] tabular-nums ${
                  !activeCategorySlug ? 'text-white/80' : 'text-[#6B7280]'
                }`}
              >
                {totalCatalogCount}
              </span>
            )}
          </button>

          {/* Main Categories with light border & bold typography */}
          {mainCategories.map((parent) => {
            const children = getDescendantsForParent(parent.id);
            const isExpanded = expandedParentIds.includes(parent.id);
            const isParentSelected = activeCategorySlug === parent.slug;
            const hasSelectedChild = children.some((ch) => ch.slug === activeCategorySlug);
            const isHighlighted = isParentSelected || hasSelectedChild;

            return (
              <div
                key={parent.id}
                className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
                  isParentSelected
                    ? 'border-[#8B5D36]/55 bg-white shadow-[0_4px_14px_rgba(115,73,38,0.10)]'
                    : isHighlighted || isExpanded
                    ? 'border-[#C5A482] bg-white shadow-[0_2px_10px_rgba(115,73,38,0.05)]'
                    : 'border-[#E5E7EB] bg-[#FAFAFB] hover:border-[#D1D5DB] hover:bg-white'
                }`}
              >
                {/* Main Category Trigger Row */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleSelectMainCategoryAjax(parent)}
                    onMouseEnter={() => {
                      prefetchCatalog({ category: parent.slug });
                      void fetchCachedQuery(`/api/categories/${parent.slug}/subcategories`).catch(() => {});
                    }}
                    aria-expanded={isExpanded}
                    className={`flex-1 flex items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      isParentSelected
                        ? 'text-[#111827] font-extrabold'
                        : 'text-[#111827] font-bold'
                    }`}
                  >
                    <span className="text-[15.5px] leading-snug tracking-[-0.01em]">
                      {parent.name}
                    </span>
                    {typeof parent.productCount === 'number' && (
                      <span className="text-[13px] font-semibold text-[#6B7280] tabular-nums shrink-0">
                        {parent.productCount}
                      </span>
                    )}
                  </button>

                  {(children.length > 0 || loadingSubcatParentId === parent.id) && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleParentOnly(e, parent)}
                      aria-label={isExpanded ? `Collapse ${parent.name}` : `Expand ${parent.name}`}
                      className="pr-3 pl-1 py-2.5 text-[#6B7280] hover:text-[#111827] cursor-pointer shrink-0"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-150 ${
                          isExpanded ? 'rotate-180 text-[#111827]' : ''
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* Expanded Subcategories Drawer (AJAX Loaded) */}
                {isExpanded && (
                  <div className="border-t border-[#F0F1F3] bg-white px-2.5 py-2 space-y-0.5">
                    {loadingSubcatParentId === parent.id && children.length === 0 ? (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#6B7280]">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading subcategories...</span>
                      </div>
                    ) : children.length > 0 ? (
                      children.map((ch) => {
                        const isChildActive = activeCategorySlug === ch.slug;
                        const indentPx = 10 + (ch.depth || 0) * 12;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => handleSelectSubcategoryAjax(parent, ch)}
                            onMouseEnter={() => prefetchCatalog({ category: ch.slug })}
                            style={{ paddingLeft: `${indentPx}px` }}
                            className={`w-full flex items-center justify-between gap-2 pr-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                              isChildActive
                                ? 'bg-[#F3F4F6] text-[#111827] font-semibold'
                                : 'text-[#6B7280] font-normal hover:bg-[#F7F7F8] hover:text-[#111827]'
                            }`}
                          >
                            <span className="truncate">{ch.name}</span>
                            {typeof ch.productCount === 'number' && (
                              <span className="text-[13px] text-[#9CA3AF] tabular-nums shrink-0">
                                {ch.productCount}
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-2.5 py-1 text-[13px] text-[#9CA3AF]">No subcategories</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Brands */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">Makers & Brands</h3>
        <ul className="space-y-1.5 text-sm">
          <li>
            <button
              type="button"
              onClick={() => updateParam('brand', '')}
              className={`text-left cursor-pointer ${!activeBrandSlug ? 'font-bold text-[#111827]' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              All Brands
            </button>
          </li>
          {brands.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => updateParam('brand', b.slug)}
                className={`text-left cursor-pointer ${activeBrandSlug === b.slug ? 'font-bold text-[#111827]' : 'text-[#6B7280] hover:text-[#111827]'}`}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Attributes */}
      {attributes
        .filter((a) => a.usedForFiltering && a.values.length > 0)
        .map((attr) => (
          <div key={attr.id}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">{attr.name}</h3>
            <div className="flex flex-wrap gap-2">
              {attr.values.map((val) => {
                const active = selectedAttrVals.includes(val.id);
                return (
                  <button
                    key={val.id}
                    type="button"
                    onClick={() => toggleAttrFilter(val.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'ka-oak-btn'
                        : 'bg-[#F7F7F8] text-[#374151] border-[#E5E7EB] hover:border-[#8B5D36]'
                    }`}
                  >
                    {val.colorHex && (
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: val.colorHex }}
                      />
                    )}
                    <span>{val.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      {/* Price Range */}
      {showPriceFilter && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">Price Range</h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min"
              value={activeMinPrice}
              onChange={(e) => updateParam('minPrice', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl tabular-nums focus:outline-none focus:ring-2 focus:ring-[#171717]"
            />
            <input
              type="number"
              placeholder="Max"
              value={activeMaxPrice}
              onChange={(e) => updateParam('maxPrice', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl tabular-nums focus:outline-none focus:ring-2 focus:ring-[#171717]"
            />
          </div>
        </div>
      )}

      {/* Availability */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">Availability</h3>
        <select
          value={activeAvail}
          onChange={(e) => updateParam('availability', e.target.value)}
          className="w-full px-3 py-2 text-xs font-medium bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717]"
        >
          <option value="">All Items</option>
          <option value="in_stock">In Stock Only</option>
        </select>
      </div>
    </div>
  );

  return (
    <>
      <SeoHead
        title={pageTitle}
        description={currentCategory?.seoDescription || currentBrand?.seoDescription || 'Browse our full product collection.'}
        canonicalPath={canonicalPath}
        noIndex={hasFilters}
      />

      <div className="ka-container py-10">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-[#6B7280] mb-6 flex items-center gap-2">
          <Link to="/" className="hover:text-[#111827]">
            Home
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-[#111827]">
            Shop
          </Link>
          {parentCategory && (
            <>
              <span>/</span>
              <Link to={`/categories/${parentCategory.slug}`} className="hover:text-[#111827]">
                {parentCategory.name}
              </Link>
            </>
          )}
          {currentCategory && (
            <>
              <span>/</span>
              <span className="text-[#111827] font-semibold">{currentCategory.name}</span>
            </>
          )}
          {currentBrand && (
            <>
              <span>/</span>
              <span className="text-[#111827] font-semibold">{currentBrand.name}</span>
            </>
          )}
        </nav>

        {/* Big Live AJAX Search Engine */}
        <div className="mb-7 relative z-30 ka-appear">
          <AjaxSearchEngine variant="hero" initialQuery={activeSearch} />
        </div>

        {/* Page Heading */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 ka-appear">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827]">
              {currentCategory
                ? currentCategory.name
                : currentBrand
                ? currentBrand.name
                : activeSearch
                ? `Search: "${activeSearch}"`
                : 'Home & Office Furniture'}
            </h1>
            <p className="text-sm text-[#6B7280] mt-2 max-w-2xl">
              {currentCategory?.description ||
                currentBrand?.description ||
                'Architectural desks, ergonomic office chairs, bouclé lounge seating, and solid oak credenzas for residential and studio spaces.'}
            </p>

            {/* Quick Room / Space Segmented Switcher */}
            {!currentCategory && !currentBrand && (
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F3F4F6] rounded-2xl mt-4">
                <button
                  type="button"
                  onClick={handleSelectAllProductsAjax}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                    !activeCategorySlug
                      ? 'bg-white text-[#111827] shadow-xs'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  All Spaces
                </button>
                {mainCategories.slice(0, 3).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectMainCategoryAjax(cat)}
                    onMouseEnter={() => prefetchCatalog({ category: cat.slug })}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                      activeCategorySlug === cat.slug
                        ? 'bg-white text-[#111827] shadow-xs'
                        : 'text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {subcategories.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mt-4">
                {subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => currentCategory && handleSelectSubcategoryAjax(currentCategory, sub)}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-[#F7F7F8] border border-[#E5E7EB] text-[#111827] rounded-xl hover:border-[#8B5D36] transition-colors cursor-pointer"
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
            <span className="text-xs font-medium text-[#6B7280] tabular-nums">{pagination.total} items</span>
            <select
              value={activeSort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="px-3.5 py-2 text-xs font-semibold bg-[#F7F7F8] border border-[#E5E7EB] text-[#111827] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717]"
              aria-label="Sort products"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest Arrivals</option>
              {showPriceFilter && <option value="price_asc">Price: Low to High</option>}
              {showPriceFilter && <option value="price_desc">Price: High to Low</option>}
              <option value="name_asc">Name: A to Z</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block lg:col-span-3">{FilterPanel}</aside>

          {/* Product Grid */}
          <div className="lg:col-span-9">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="bg-white border border-[#F0F1F3] rounded-3xl h-96 animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-[#F0F1F3] rounded-3xl p-12 text-center shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
                <p className="text-sm text-[#6B7280] mb-5">No products matched your selected filters.</p>
                <button
                  type="button"
                  onClick={handleSelectAllProductsAjax}
                  className="inline-block px-5 py-2.5 text-xs font-semibold ka-oak-btn rounded-2xl cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className={`transition-opacity duration-150 ${updatingAjax ? 'opacity-60' : 'opacity-100'}`}>
                <div
                  className={
                    currentCategory?.displayLayout === 'list'
                      ? 'space-y-6'
                      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                  }
                >
                  {products.map((prod, idx) => (
                    <div
                      key={`${prod.id}-${activeCategorySlug}-${activeBrandSlug}-${activeSearch}-${pagination.page}`}
                      style={{ animationDelay: `${Math.min(idx, 11) * 40}ms` }}
                      className="ka-appear"
                    >
                      <ProductCard product={prod} />
                    </div>
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    {Array.from({ length: pagination.totalPages }).map((_, idx) => {
                      const pNum = idx + 1;
                      return (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => updateParam('page', String(pNum))}
                          className={`px-4 py-2 text-xs font-semibold rounded-xl tabular-nums cursor-pointer ${
                            pagination.page === pNum
                              ? 'ka-oak-btn'
                              : 'bg-white border border-[#E5E7EB] text-[#111827] hover:bg-[#F3F4F6] hover:border-[#C5A482]'
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-start lg:hidden">
          <div className="w-80 bg-[#F7F7F8] h-full p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#111827]">Filters</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {FilterPanel}
          </div>
        </div>
      )}
    </>
  );
};
