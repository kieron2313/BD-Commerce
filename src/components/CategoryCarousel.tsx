import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sofa,
  Briefcase,
  Lamp,
  Armchair,
  Box,
  Layers,
} from 'lucide-react';
import { prefetchCatalog } from '../lib/prefetch';
import { OAK_FRAME_PRESETS, OakFramePreset } from './OakFrame';

export interface CategoryCarouselItem {
  id: number;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
}

const FRAME_PRESETS: OakFramePreset[] = OAK_FRAME_PRESETS;

function getCategoryIcon(cat: CategoryCarouselItem) {
  const key = `${cat.icon || ''} ${cat.slug} ${cat.name}`.toLowerCase();
  if (key.includes('home') || key.includes('sofa') || key.includes('living')) {
    return Sofa;
  }
  if (key.includes('office') || key.includes('briefcase') || key.includes('desk')) {
    return Briefcase;
  }
  if (key.includes('lamp') || key.includes('light') || key.includes('pendant')) {
    return Lamp;
  }
  if (key.includes('seat') || key.includes('chair') || key.includes('stool') || key.includes('joinery')) {
    return Armchair;
  }
  if (key.includes('credenza') || key.includes('storage') || key.includes('layers')) {
    return Layers;
  }
  return Box;
}

const CategoryVignetteCard: React.FC<{
  category: CategoryCarouselItem;
  preset: OakFramePreset;
  uid: string;
  isActive?: boolean;
}> = ({ category, preset, uid, isActive = false }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const clipId = `cat-clip-${uid}-${category.id}`;
  const gradId = `cat-wood-${uid}-${category.id}`;
  const tintId = `cat-tint-${uid}-${category.id}`;
  const fallbackGradId = `cat-fallback-${uid}-${category.id}`;
  const waveShadowId = `cat-wave-${uid}-${category.id}`;
  const IconComp = getCategoryIcon(category);

  return (
    <Link
      to={`/categories/${category.slug}`}
      onMouseEnter={() => prefetchCatalog({ category: category.slug })}
      onFocus={() => prefetchCatalog({ category: category.slug })}
      className={`group relative block aspect-[400/360] w-full select-none transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-none ${
        isActive ? '-translate-y-0.5' : ''
      }`}
    >
      {/* Unified Sculpted Oak Frame + Clipped Photo + Wavy Cream Caption Plate */}
      <svg
        viewBox="0 0 400 360"
        className={`w-full h-full transition-[filter] duration-200 ${
          isActive
            ? 'drop-shadow-[0_18px_28px_rgba(68,42,20,0.22)]'
            : 'drop-shadow-[0_14px_24px_rgba(68,42,20,0.16)] group-hover:drop-shadow-[0_20px_30px_rgba(68,42,20,0.22)]'
        }`}
        role="img"
        aria-label={category.name}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#CEA173" />
            <stop offset="45%" stopColor="#B07D4F" />
            <stop offset="100%" stopColor="#865833" />
          </linearGradient>
          <linearGradient id={tintId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7C532E" stopOpacity="0.06" />
            <stop offset="70%" stopColor="#7C532E" stopOpacity="0" />
            <stop offset="100%" stopColor="#4E3119" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id={fallbackGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EFE6DA" />
            <stop offset="100%" stopColor="#DECBB4" />
          </linearGradient>
          <clipPath id={clipId}>
            <path d={preset.innerPath} />
          </clipPath>
          <filter id={waveShadowId} x="-5%" y="-10%" width="110%" height="125%">
            <feDropShadow dx="0" dy="-3" stdDeviation="3" floodColor="#4E3119" floodOpacity="0.14" />
          </filter>
        </defs>

        {/* Outer Solid Oak Wood Frame */}
        <path d={preset.outerPath} fill={`url(#${gradId})`} />
        <path
          d={preset.outerPath}
          fill="none"
          stroke={isActive ? 'rgba(255,244,228,0.72)' : 'rgba(255,244,228,0.48)'}
          strokeWidth={isActive ? '2' : '1.5'}
        />

        {/* Interior Clipped Window: Photo + Wavy Cream Plate */}
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="400" height="360" fill={`url(#${fallbackGradId})`} />
          {!imgFailed && category.imageUrl && (
            <image
              href={category.imageUrl}
              x="12"
              y="12"
              width="376"
              height="248"
              preserveAspectRatio="xMidYMid slice"
              onError={() => setImgFailed(true)}
              className="origin-center transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          )}
          <rect x="0" y="0" width="400" height="260" fill={`url(#${tintId})`} />

          {/* Wavy Cream Bottom Caption Plate */}
          <path d={preset.wavePath} fill="#F8F3EC" filter={`url(#${waveShadowId})`} />
          <path
            d={preset.wavePath}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="1.5"
          />
        </g>

        {/* Recessed Wood Rim Inner Bevel */}
        <path
          d={preset.innerPath}
          fill="none"
          stroke="rgba(72, 44, 21, 0.28)"
          strokeWidth="2.5"
        />
      </svg>

      {/* Crisp HTML Typography & Controls Layered Over Cream Wave Plate */}
      <div className="absolute left-[7%] right-[7%] bottom-[5%] h-[28%] flex items-center gap-2.5 px-2.5 sm:px-3">
        <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-[#775132] shrink-0">
          <IconComp className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.6} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] sm:text-[16px] xl:text-[17px] font-bold text-[#231912] tracking-tight leading-tight truncate">
            {category.name}
          </h3>
          <p className="text-[11px] sm:text-[11.5px] text-[#6E5644] leading-[1.35] line-clamp-2 mt-0.5">
            {category.description || 'Explore handcrafted home and office pieces.'}
          </p>
        </div>

        <span
          aria-hidden="true"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#A67549] via-[#8B5D36] to-[#734926] group-hover:from-[#95673E] group-hover:via-[#7B512E] group-hover:to-[#633E1F] ring-1 ring-inset ring-[#E6BE94]/35 text-white flex items-center justify-center shrink-0 shadow-[0_4px_10px_rgba(115,73,38,0.25)] transition-all duration-200 group-hover:scale-105 group-hover:translate-x-0.5"
        >
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
};

export const CategoryCarousel: React.FC<{
  categories: CategoryCarouselItem[];
  title?: string;
  subtitle?: string;
}> = ({
  categories,
  title = 'Featured Disciplines',
  subtitle = 'Explore our curated categories for home and office.',
}) => {
  const rawUid = useId();
  const uid = rawUid.replace(/:/g, '');
  const [visibleCount, setVisibleCount] = useState(4);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const updateCount = () => {
      const w = window.innerWidth;
      if (w < 640) setVisibleCount(1);
      else if (w < 1024) setVisibleCount(2);
      else if (w < 1200) setVisibleCount(3);
      else setVisibleCount(4);
    };
    updateCount();
    window.addEventListener('resize', updateCount);
    return () => window.removeEventListener('resize', updateCount);
  }, []);

  const maxOffset = Math.max(0, categories.length - visibleCount);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, categories.length - 1)));
    setSlideOffset((prev) => Math.min(prev, maxOffset));
  }, [categories.length, maxOffset]);

  const selectIndex = (nextIdx: number) => {
    if (categories.length === 0) return;
    const bounded = ((nextIdx % categories.length) + categories.length) % categories.length;
    setActiveIndex(bounded);
    setSlideOffset((prevOffset) => {
      if (bounded < prevOffset) return Math.min(bounded, maxOffset);
      if (bounded >= prevOffset + visibleCount) {
        return Math.min(bounded - visibleCount + 1, maxOffset);
      }
      return Math.min(prevOffset, maxOffset);
    });
  };

  useEffect(() => {
    if (isPaused || categories.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => {
        const next = prev >= categories.length - 1 ? 0 : prev + 1;
        setSlideOffset((prevOffset) => {
          if (next < prevOffset) return Math.min(next, maxOffset);
          if (next >= prevOffset + visibleCount) {
            return Math.min(next - visibleCount + 1, maxOffset);
          }
          return Math.min(prevOffset, maxOffset);
        });
        return next;
      });
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isPaused, categories.length, visibleCount, maxOffset]);

  if (categories.length === 0) return null;

  const handlePrev = () => selectIndex(activeIndex - 1);
  const handleNext = () => selectIndex(activeIndex + 1);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = touchStartX.current - endX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  const gapPx = visibleCount === 1 ? 0 : 20;
  const progressPct = ((activeIndex + 1) / categories.length) * 100;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      className="relative w-full py-12 sm:py-16 bg-gradient-to-br from-[#F9F4EE] via-[#F2E9DD] to-[#EADDCF] border-y border-[#E5D7C6] shadow-[0_14px_40px_rgba(92,62,36,0.06)] overflow-hidden"
    >
      {/* Subtle warm architectural sunlight glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-white/55 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 w-96 h-96 rounded-full bg-[#DFCBB3]/35 blur-3xl"
      />

      <div className="relative z-10 ka-container">
        {/* Compact Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#231912]">
              {title}
            </h2>
            <p className="text-sm sm:text-base text-[#6E5644] mt-1">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-end shrink-0">
            {categories.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous category"
                  className="w-9 h-9 rounded-full bg-white/85 hover:bg-white border border-[#DECFC0] text-[#231912] flex items-center justify-center shadow-xs transition-all hover:scale-105 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next category"
                  className="w-9 h-9 rounded-full bg-white/85 hover:bg-white border border-[#DECFC0] text-[#231912] flex items-center justify-center shadow-xs transition-all hover:scale-105 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <Link
              to="/shop"
              onMouseEnter={() => prefetchCatalog()}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#5A402A] hover:text-[#231912] transition-colors whitespace-nowrap"
            >
              <span>View All Categories</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Horizontal Labeled Timeline Stepper Track (matching reference design) */}
        <div className="relative mb-8 overflow-x-auto pb-1">
          <div
            className="relative min-w-[540px]"
            role="tablist"
            aria-label="Furniture Categories Timeline"
          >
            {/* Full-width horizontal baseline track */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 bottom-3 h-[1.5px] bg-[#D6C7B5]"
            />
            {/* Active progress segment extending cleanly through active bullseye */}
            <div
              aria-hidden="true"
              className="absolute left-0 bottom-[11.5px] h-[2px] bg-[#231912] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${progressPct}%` }}
            />

            <div
              className="grid items-end relative z-10"
              style={{
                gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))`,
              }}
            >
              {categories.map((cat, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => selectIndex(idx)}
                    className="group flex flex-col items-center justify-end gap-3.5 px-2 pt-1 pb-0.5 cursor-pointer focus-visible:outline-none"
                  >
                    <span
                      className={`text-[11px] sm:text-xs font-bold uppercase tracking-[0.14em] text-center truncate max-w-full transition-colors duration-200 ${
                        isActive
                          ? 'text-[#231912]'
                          : 'text-[#7B6451] group-hover:text-[#231912]'
                      }`}
                    >
                      {cat.name}
                    </span>

                    <span className="h-6 flex items-center justify-center">
                      {isActive ? (
                        <span className="w-6 h-6 rounded-full bg-[#F5EDE2] border-[1.5px] border-[#231912] flex items-center justify-center shadow-[0_2px_6px_rgba(35,25,18,0.12)] transition-transform duration-200 scale-100">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#231912]" />
                        </span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#CBB9A4] group-hover:bg-[#8B5D36] transition-all duration-200 group-hover:scale-125" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sliding Carousel Track keeping the warm oak-framed category cards */}
        <div
          className="overflow-hidden py-3 -my-3 px-1 -mx-1"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
            style={{
              gap: `${gapPx}px`,
              transform: `translate3d(calc(-${slideOffset} * (${100 / visibleCount}% + ${
                gapPx / visibleCount
              }px)), 0, 0)`,
            }}
          >
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                style={{
                  flex: `0 0 calc((100% - ${(visibleCount - 1) * gapPx}px) / ${visibleCount})`,
                }}
                className="min-w-0"
              >
                <CategoryVignetteCard
                  category={cat}
                  preset={FRAME_PRESETS[idx % FRAME_PRESETS.length]}
                  uid={uid}
                  isActive={idx === activeIndex}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
