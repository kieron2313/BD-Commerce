import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { ProductCard, ProductCardData } from '../components/ProductCard';
import { CategoryCarousel } from '../components/CategoryCarousel';
import { HeroShowcase } from '../components/HeroShowcase';
import { AjaxSearchEngine } from '../components/AjaxSearchEngine';
import { SeoHead } from '../components/SeoHead';
import { useScrollReveal } from '../hooks/useScrollReveal';
import {
  fetchCachedQuery,
  getCachedQuery,
  prefetchCatalog,
  prefetchProduct,
} from '../lib/prefetch';

const FEATURED_URL = '/api/products?featured=true&limit=3';
const ARRIVALS_URL = '/api/products?isNew=true&limit=3';

export const HomePage: React.FC = () => {
  const { settings, categories, brands, operatingMode } = usePlatform();
  const [featured, setFeatured] = useState<ProductCardData[]>(
    () => getCachedQuery<{ products?: ProductCardData[] }>(FEATURED_URL)?.products || []
  );
  const [arrivals, setArrivals] = useState<ProductCardData[]>(
    () => getCachedQuery<{ products?: ProductCardData[] }>(ARRIVALS_URL)?.products || []
  );
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterDone, setNewsletterDone] = useState(false);

  const disciplinesReveal = useScrollReveal<HTMLElement>();
  const signatureReveal = useScrollReveal<HTMLElement>();
  const editionsReveal = useScrollReveal<HTMLElement>();

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCachedQuery<{ products?: ProductCardData[] }>(FEATURED_URL, {
        onRevalidate: (fresh) => active && setFeatured(fresh.products || []),
      }),
      fetchCachedQuery<{ products?: ProductCardData[] }>(ARRIVALS_URL, {
        onRevalidate: (fresh) => active && setArrivals(fresh.products || []),
      }),
    ])
      .then(([featData, newData]) => {
        if (!active) return;
        const featList = featData.products || [];
        const newList = newData.products || [];
        setFeatured(featList);
        setArrivals(newList);

        const warm = () => {
          [...featList, ...newList].slice(0, 3).forEach((p) => prefetchProduct(p.slug, p.mainImageUrl));
        };
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(warm);
        } else {
          setTimeout(warm, 300);
        }
      })
      .catch((err) => console.error('Homepage load error:', err));

    return () => {
      active = false;
    };
  }, [operatingMode]);

  const parentCategories = categories.filter((c) => !c.parentId);
  const heroImage =
    settings.general?.heroImageUrl || '/src/assets/images/hero_home_office_furniture_1794755051626.jpg';

  return (
    <>
      <SeoHead
        title={settings.seo?.defaultMetaTitle || 'Kanso Atelier – Home & Office Furniture'}
        description={
          settings.seo?.defaultMetaDescription ||
          'Explore architectural home and office furniture: solid walnut executive desks, ergonomic task chairs, bouclé lounge seating, and oak credenzas.'
        }
        ogImage={heroImage}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: settings.general?.siteName || 'Kanso Atelier',
          url: window.location.origin,
          email: settings.general?.contactEmail || 'studio@kansoatelier.com',
          telephone: settings.general?.phone || '+1 (415) 890-4210',
        }}
      />

      {/* Big Live AJAX Search Engine Stage */}
      <section className="ka-container pt-7 pb-2 relative z-30 ka-appear">
        <AjaxSearchEngine variant="hero" />
      </section>

      {/* Section 1: Architectural Carved Cutout Hero with Rotating Imagery, Dynamic Headline & Pulsing CTA */}
      <section className="ka-container pt-5 pb-12 ka-appear">
        <HeroShowcase generalSettings={settings.general} />
      </section>

      {/* Section 2: Full-Width Warm Oak-Framed Category Carousel */}
      {parentCategories.length > 0 && (
        <section
          ref={disciplinesReveal.ref}
          className={`w-full my-4 sm:my-6 ka-reveal ${
            disciplinesReveal.visible ? 'ka-reveal-visible' : 'ka-reveal-hidden'
          }`}
        >
          <CategoryCarousel
            categories={parentCategories}
            title="Featured Disciplines"
            subtitle="Explore our curated categories for home and office."
          />
        </section>
      )}

      {/* Section 3: Signature Home & Office Furniture */}
      <section
        ref={signatureReveal.ref}
        className={`ka-container py-12 ka-reveal ${
          signatureReveal.visible ? 'ka-reveal-visible' : 'ka-reveal-hidden'
        }`}
      >
        <div className="flex items-baseline justify-between mb-7">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
              Signature Furniture
            </h2>
            <p className="text-sm text-[#6B7280] mt-1">
              Configurable solid timber finishes, bouclé &amp; leather upholsteries, and workspace sizes.
            </p>
          </div>
          <Link to="/shop" className="text-sm font-semibold text-[#111827] hover:underline whitespace-nowrap">
            Shop All
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {featured.map((prod, idx) => (
            <div
              key={prod.id}
              style={{ animationDelay: `${idx * 65}ms` }}
              className="ka-appear"
            >
              <ProductCard product={prod} />
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Recent Editions + Workshops & Studio Dispatch */}
      <section
        ref={editionsReveal.ref}
        className={`ka-container py-12 ka-reveal ${
          editionsReveal.visible ? 'ka-reveal-visible' : 'ka-reveal-hidden'
        }`}
      >
        <div className="flex items-baseline justify-between mb-7">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
              Recent Editions
            </h2>
            <p className="text-sm text-[#6B7280] mt-1">
              Newly released credenzas, study tables, and architectural lighting for home and office.
            </p>
          </div>
          <Link
            to="/shop?sort=newest"
            className="text-sm font-semibold text-[#111827] hover:underline whitespace-nowrap"
          >
            Explore New Releases
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 mb-14">
          {arrivals.map((prod, idx) => (
            <div
              key={prod.id}
              style={{ animationDelay: `${idx * 65}ms` }}
              className="ka-appear"
            >
              <ProductCard product={prod} />
            </div>
          ))}
        </div>

        {/* Maker / Material Provenance & Studio Dispatch */}
        <div className="bg-white rounded-3xl p-7 sm:p-9 border border-[#F0F1F3] shadow-[0_12px_32px_rgba(17,24,39,0.06)] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] mb-3">Partner Workshops &amp; Furniture Makers</p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                {brands.map((b) => (
                  <Link
                    key={b.id}
                    to={`/brands/${b.slug}`}
                    onMouseEnter={() => prefetchCatalog({ brand: b.slug })}
                    className="text-xl font-bold tracking-tight text-[#111827] hover:text-[#15803D] transition-colors"
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-t border-[#F0F1F3] pt-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <p className="text-sm font-bold text-[#111827]">Home Living</p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Bouclé armchairs, oak credenzas, and dining tables crafted for daily comfort.
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-[#111827]">Office Workspaces</p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Walnut executive desks and ergonomic task chairs engineered for focus.
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-[#111827]">Trade &amp; COD Delivery</p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Direct residential Cash on Delivery or custom project quotes within 24h.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#F7F7F8] border border-[#EAECEF] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-[#111827] mb-1">Furniture &amp; Material Dispatch</h3>
            <p className="text-xs text-[#6B7280] mb-4">
              Seasonal timber finishes, ergonomic seating releases, and architectural trade swatches.
            </p>
            {newsletterDone ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-[#15803D] bg-[#DCFCE7] px-3.5 py-2.5 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
                <span>Subscribed to Kanso Atelier dispatches.</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newsletterEmail.trim()) setNewsletterDone(true);
                }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Email address"
                  className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717]"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold ka-oak-btn rounded-xl whitespace-nowrap cursor-pointer"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
};
