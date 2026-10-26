import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Play, Pause, ExternalLink } from 'lucide-react';
import { getActivePromoBanners, getPromoSettings } from '../lib/promoService';
import type { PromoBanner, PromoSettings, NavigationTab } from '../types';

interface PromoCarouselProps {
  onNavigate?: (tab: NavigationTab) => void;
}

export const PromoCarousel: React.FC<PromoCarouselProps> = ({ onNavigate }) => {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [settings, setSettings] = useState<PromoSettings>({ enabled: true, intervalSeconds: 5 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [touchResumeTimerActive, setTouchResumeTimerActive] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Swipe coordinates
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const touchResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch banners & settings once
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [activeBanners, promoSettings] = await Promise.all([
          getActivePromoBanners(),
          getPromoSettings(),
        ]);
        if (isMounted) {
          setBanners(activeBanners);
          setSettings(promoSettings);
        }
      } catch (err) {
        console.warn('[PromoCarousel] Could not load banners:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener?.('change', listener);
      return () => {
        isMounted = false;
        mediaQuery.removeEventListener?.('change', listener);
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Track visibilitychange
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabHidden(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Preload next image
  useEffect(() => {
    if (banners.length > 1) {
      const nextIndex = (currentIndex + 1) % banners.length;
      const nextBanner = banners[nextIndex];
      if (nextBanner?.imageUrl) {
        const img = new Image();
        img.src = nextBanner.imageUrl;
      }
    }
  }, [currentIndex, banners]);

  const goToNext = useCallback(() => {
    if (banners.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const goToPrev = useCallback(() => {
    if (banners.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // Autoplay effect
  useEffect(() => {
    if (
      !settings.enabled ||
      banners.length <= 1 ||
      isManualPaused ||
      isHovered ||
      isTouching ||
      touchResumeTimerActive ||
      isTabHidden ||
      reducedMotion
    ) {
      return;
    }

    const intervalMs = Math.max(2, settings.intervalSeconds || 5) * 1000;
    const timer = setInterval(() => {
      goToNext();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    settings.enabled,
    settings.intervalSeconds,
    banners.length,
    isManualPaused,
    isHovered,
    isTouching,
    touchResumeTimerActive,
    isTabHidden,
    reducedMotion,
    goToNext,
  ]);

  // Touch handlers for RTL swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsTouching(true);
    if (touchResumeTimeoutRef.current) {
      clearTimeout(touchResumeTimeoutRef.current);
      touchResumeTimeoutRef.current = null;
    }
    setTouchResumeTimerActive(false);
    touchStartXRef.current = e.touches[0].clientX;
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsTouching(false);
    if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
      const diff = touchStartXRef.current - touchEndXRef.current;
      // In RTL: swipe to left (diff > 45) means advancing forward to next slide
      // swipe to right (diff < -45) means going back to previous slide
      if (diff > 45) {
        goToNext();
      } else if (diff < -45) {
        goToPrev();
      }
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;

    // Resume rotation after 3 seconds of leaving touch
    setTouchResumeTimerActive(true);
    touchResumeTimeoutRef.current = setTimeout(() => {
      setTouchResumeTimerActive(false);
      touchResumeTimeoutRef.current = null;
    }, 3000);
  };

  // Handle banner link click
  const handleBannerClick = (banner: PromoBanner) => {
    if (!banner.linkType || banner.linkType === 'none' || !banner.linkTarget) return;

    if (banner.linkType === 'external') {
      let url = banner.linkTarget.trim();
      if (url.includes('arixon-tawjihi-2009')) {
        url = 'https://chat.whatsapp.com/FQ39q5zXeZq8DJeeuPJNpu';
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      try {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened || opened.closed || typeof opened.closed === 'undefined') {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch {
        window.location.href = url;
      }
      return;
    }

    if (banner.linkType === 'internal') {
      const target = banner.linkTarget.trim().replace(/^\//, '') as NavigationTab;
      if (onNavigate) {
        onNavigate(target);
      }
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (touchResumeTimeoutRef.current) {
        clearTimeout(touchResumeTimeoutRef.current);
      }
    };
  }, []);

  // If loading or carousel is disabled or no active banners, render nothing (no empty container)
  if (isLoading || !settings.enabled || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex] || banners[0];
  const hasMultiple = banners.length > 1;
  const isClickable =
    currentBanner.linkType &&
    currentBanner.linkType !== 'none' &&
    Boolean(currentBanner.linkTarget);

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="الإعلانات المصوّرة في أريكسون"
      className="relative w-full aspect-video max-h-[380px] rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 dark:border-slate-800/90 bg-slate-900 shadow-md select-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides Container */}
      <div className="relative w-full h-full">
        {banners.map((banner, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`شريحة ${index + 1} من ${banners.length}: ${banner.alt || 'إعلان أريكسون'}`}
              aria-hidden={!isActive}
              onClick={() => isActive && handleBannerClick(banner)}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              } ${isClickable && isActive ? 'cursor-pointer' : ''}`}
            >
              <img
                src={banner.imageUrl}
                alt={banner.alt || 'إعلان ترويجي'}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                className="w-full h-full object-cover"
              />

              {/* Gradient Scrim for Contrast & Subtle Vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

              {/* Banner Caption / Link Indicator */}
              <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-5 left-3 sm:left-5 flex items-end justify-between pointer-events-none z-20">
                {banner.alt && (
                  <p className="text-white text-xs sm:text-sm font-bold drop-shadow-md line-clamp-1 max-w-[80%]">
                    {banner.alt}
                  </p>
                )}
                {isClickable && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-white/90 text-slate-900 backdrop-blur-xs shadow-xs shrink-0 mr-auto">
                    <span>انقر للمشاهدة</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Controls (If multiple banners) */}
      {hasMultiple && (
        <>
          {/* RTL Prev Button (Right Side in RTL visual layout) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="الشريحة السابقة"
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-xs transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* RTL Next Button (Left Side in RTL visual layout) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="الشريحة التالية"
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-xs transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Small Pause/Play Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsManualPaused((prev) => !prev);
            }}
            aria-label={isManualPaused ? 'تشغيل التبديل التلقائي' : 'إيقاف التبديل التلقائي مؤقتاً'}
            title={isManualPaused ? 'تشغيل التبديل التلقائي' : 'إيقاف التبديل التلقائي مؤقتاً'}
            className="absolute top-3 left-3 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer shadow-sm"
          >
            {isManualPaused ? (
              <Play className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Pause className="w-3.5 h-3.5 fill-current" />
            )}
          </button>

          {/* Dots Indicator */}
          <div
            className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-xs"
            role="tablist"
            aria-label="شرائح الإعلانات"
          >
            {banners.map((_, idx) => {
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  aria-label={`الانتقال إلى الشريحة ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    isCurrent ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
