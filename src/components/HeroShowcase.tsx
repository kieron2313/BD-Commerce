import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { SafeImage } from './SafeImage';
import { prefetchCatalog } from '../lib/prefetch';

export interface HeroSlideItem {
  id: string;
  imageUrl: string;
  headline: string;
}

export const DEFAULT_HERO_SLIDES: HeroSlideItem[] = [
  {
    id: 'default-1',
    imageUrl: '/src/assets/images/hero_home_office_furniture_1794755051626.jpg',
    headline: 'FURNITURE THAT LASTS',
  },
  {
    id: 'default-2',
    imageUrl: '/src/assets/images/furniture_lounge_sofa_1794755051960.jpg',
    headline: 'TIMELESS HOME LIVING',
  },
  {
    id: 'default-3',
    imageUrl: '/src/assets/images/furniture_executive_desk_1794755052336.jpg',
    headline: 'CRAFTED FOR WORKSPACES',
  },
];

export const HeroShowcase: React.FC<{
  generalSettings?: Record<string, any>;
}> = ({ generalSettings = {} }) => {
  const rawUid = useId();
  const uid = rawUid.replace(/:/g, '');

  const slides: HeroSlideItem[] = useMemo(() => {
    const raw = Array.isArray(generalSettings.heroSlides) ? generalSettings.heroSlides : [];
    const valid = raw
      .filter((s: any) => s && (s.imageUrl?.trim() || s.headline?.trim()))
      .map((s: any, i: number) => ({
        id: String(s.id || `slide-${i}`),
        imageUrl:
          String(s.imageUrl || '').trim() ||
          generalSettings.heroImageUrl ||
          DEFAULT_HERO_SLIDES[i % DEFAULT_HERO_SLIDES.length].imageUrl,
        headline:
          String(s.headline || '').trim() ||
          generalSettings.heroHeadline ||
          DEFAULT_HERO_SLIDES[i % DEFAULT_HERO_SLIDES.length].headline,
      }));
    if (valid.length > 0) return valid;

    // Fallback using configured single hero image/headline + curated furniture rotations
    return [
      {
        id: 'fallback-1',
        imageUrl: generalSettings.heroImageUrl || DEFAULT_HERO_SLIDES[0].imageUrl,
        headline: generalSettings.heroHeadline || DEFAULT_HERO_SLIDES[0].headline,
      },
      ...DEFAULT_HERO_SLIDES.slice(1),
    ];
  }, [generalSettings.heroSlides, generalSettings.heroImageUrl, generalSettings.heroHeadline]);

  const rotateMs = Math.max(2000, Math.min(20000, Number(generalSettings.heroRotateSeconds || 5) * 1000));
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setActiveIndex((prev) => (prev >= slides.length ? 0 : prev));
  }, [slides.length]);

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, rotateMs);
    return () => window.clearInterval(timer);
  }, [isPaused, slides.length, rotateMs]);

  const currentSlide = slides[activeIndex] || slides[0];
  const badgeRaw = String(generalSettings.heroBadgeText || 'SHOP FURNITURE').trim().toUpperCase();
  const badgeTarget = String(generalSettings.heroBadgeLink || '/shop').trim() || '/shop';

  const ringText = useMemo(() => {
    if (badgeRaw.length <= 18) {
      return `• ${badgeRaw} • ${badgeRaw} `;
    }
    return `• ${badgeRaw} `;
  }, [badgeRaw]);

  const topVal = generalSettings.heroStatTopValue ?? '15+';
  const topLabel = generalSettings.heroStatTopLabel ?? 'YEARS DESIGNING';
  const midVal = generalSettings.heroStatMidValue ?? '420+';
  const midLabel = generalSettings.heroStatMidLabel ?? 'COLLECTIONS CREATED';
  const botVal = generalSettings.heroStatBottomValue ?? '95+';
  const botLabel = generalSettings.heroStatBottomLabel ?? 'GLOBAL PARTNERS';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full min-h-[410px] sm:min-h-[490px] lg:min-h-[545px] rounded-[28px] overflow-hidden bg-[#ECECEE] shadow-[0_18px_45px_rgba(17,24,39,0.08)]"
    >
      {/* Crossfading Background Room Imagery */}
      {slides.map((slide, idx) => {
        const active = idx === activeIndex;
        return (
          <div
            key={slide.id}
            aria-hidden={!active}
            className={`absolute inset-0 transition-all duration-700 ease-out ${
              active ? 'opacity-100 scale-100 z-0' : 'opacity-0 scale-[1.02] pointer-events-none z-0'
            }`}
          >
            <SafeImage
              src={slide.imageUrl}
              alt={slide.headline}
              priority={idx === 0}
              className="w-full h-full object-cover"
            />
          </div>
        );
      })}

      {/* Subtle Warm Architectural Gradient Scrim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-black/5 z-10"
      />

      {/* TOP-LEFT CARVED CUTOUT: Dynamic Headline synced to rotating image */}
      <div className="relative sm:absolute top-0 left-0 z-20 inline-block max-w-[92%] sm:max-w-[72%] lg:max-w-[66%] bg-[#F7F7F8] rounded-br-[28px] pr-6 sm:pr-10 pl-4 sm:pl-6 pt-2.5 sm:pt-3 pb-3.5 sm:pb-5">
        <h1
          key={currentSlide.id}
          className="ka-appear text-2xl sm:text-4xl lg:text-[42px] xl:text-[48px] font-black uppercase tracking-tight text-[#111827] leading-[1.05] [text-wrap:balance]"
        >
          {currentSlide.headline}
        </h1>
        {/* Concave Fillet Right */}
        <span
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute top-0 left-full w-7 h-7"
          style={{
            background: 'radial-gradient(circle at 100% 100%, transparent 27.5px, #F7F7F8 28px)',
          }}
        />
        {/* Concave Fillet Bottom */}
        <span
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute top-full left-0 w-7 h-7"
          style={{
            background: 'radial-gradient(circle at 100% 100%, transparent 27.5px, #F7F7F8 28px)',
          }}
        />
      </div>

      {/* TOP-RIGHT CARVED CUTOUT: 15+ YEARS DESIGNING */}
      <div className="hidden sm:flex flex-col items-center justify-center absolute top-0 right-0 z-20 bg-[#F7F7F8] rounded-bl-[28px] pl-8 pr-6 pt-4 pb-5 min-w-[165px] lg:min-w-[195px]">
        <span className="text-3xl lg:text-[34px] font-black tracking-tight text-[#111827] tabular-nums leading-none">
          {topVal}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#4B5563] mt-2 whitespace-nowrap">
          {topLabel}
        </span>
        {/* Concave Fillet Left */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-full w-7 h-7"
          style={{
            background: 'radial-gradient(circle at 0% 100%, transparent 27.5px, #F7F7F8 28px)',
          }}
        />
        {/* Concave Fillet Bottom */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-full right-0 w-7 h-7"
          style={{
            background: 'radial-gradient(circle at 0% 100%, transparent 27.5px, #F7F7F8 28px)',
          }}
        />
      </div>

      {/* BOTTOM-LEFT CLUSTER: Carved Notch (95+ Global Partners) + Floating Stat Card (420+ Collections) */}
      <div className="hidden md:block absolute bottom-0 left-0 z-20">
        {/* Floating White Card Overlapping Shoulder */}
        <div className="ml-[124px] lg:ml-[156px] -mb-3 relative z-30 bg-white rounded-[22px] px-6 py-4 lg:px-8 lg:py-5 border border-[#F0F1F3] shadow-[0_14px_32px_rgba(17,24,39,0.08)] text-center min-w-[185px] lg:min-w-[205px]">
          <p className="text-3xl lg:text-[34px] font-black tracking-tight text-[#111827] tabular-nums leading-none">
            {midVal}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#4B5563] mt-2 whitespace-nowrap">
            {midLabel}
          </p>
        </div>

        {/* Carved Bottom-Left Corner Notch */}
        <div className="relative bg-[#F7F7F8] rounded-tr-[28px] pt-5 pb-4 pl-5 pr-8 text-center min-w-[175px] lg:min-w-[200px]">
          <p className="text-3xl lg:text-[34px] font-black tracking-tight text-[#111827] tabular-nums leading-none">
            {botVal}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#4B5563] mt-2 whitespace-nowrap">
            {botLabel}
          </p>
          {/* Concave Fillet Top */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-0 w-7 h-7"
            style={{
              background: 'radial-gradient(circle at 100% 0%, transparent 27.5px, #F7F7F8 28px)',
            }}
          />
          {/* Concave Fillet Right */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-full w-7 h-7"
            style={{
              background: 'radial-gradient(circle at 100% 0%, transparent 27.5px, #F7F7F8 28px)',
            }}
          />
        </div>
      </div>

      {/* Subtle Slide Switcher Indicators (when multiple rotating slides are active) */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/25 backdrop-blur-xs px-3 py-1.5 rounded-full">
          {slides.map((s, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Show slide ${idx + 1}: ${s.headline}`}
                aria-current={active ? 'true' : undefined}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  active ? 'w-6 bg-white' : 'w-1.5 bg-white/55 hover:bg-white/85'
                }`}
              />
            );
          })}
        </div>
      )}

      {/* BOTTOM-RIGHT ANIMATED PULSE CIRCULAR CTA ("SHOP FURNITURE" or Custom Admin Copy) */}
      <Link
        to={badgeTarget}
        onMouseEnter={() => prefetchCatalog()}
        onFocus={() => prefetchCatalog()}
        aria-label={badgeRaw}
        className="group absolute bottom-4 right-4 sm:bottom-7 sm:right-7 z-30 inline-flex items-center justify-center focus-visible:outline-none"
      >
        {/* Outer soft expanding pulse ring */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[#C9AB91]/45 animate-ping"
          style={{ animationDuration: '2.4s' }}
        />

        {/* Pulsing Translucent Warm Oak/Sand Ring with Custom Circular SVG Text */}
        <span className="ka-badge-pulse relative w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-full bg-gradient-to-br from-[#D6BCAA]/85 via-[#C4A58D]/85 to-[#B49077]/90 backdrop-blur-md border border-white/45 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
          <svg
            viewBox="0 0 140 140"
            className="w-full h-full pointer-events-none select-none"
            aria-hidden="true"
          >
            <defs>
              <path
                id={`hero-ring-${uid}`}
                d="M 70,70 m -49,0 a 49,49 0 1,1 98,0 a 49,49 0 1,1 -98,0"
              />
            </defs>
            <text
              fill="#FFFFFF"
              fontSize={badgeRaw.length > 22 ? '10.2' : '11.8'}
              fontWeight="700"
              letterSpacing={badgeRaw.length > 22 ? '1.8' : '2.8'}
            >
              <textPath href={`#hero-ring-${uid}`} startOffset="0%">
                {ringText}
              </textPath>
            </text>
          </svg>

          {/* Crisp White Center Arrow Disc */}
          <span className="absolute w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-white text-[#231912] flex items-center justify-center shadow-[0_6px_16px_rgba(35,25,18,0.18)]">
            <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
          </span>
        </span>
      </Link>
    </div>
  );
};
