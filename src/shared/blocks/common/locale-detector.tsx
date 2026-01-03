'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@/core/i18n/navigation';
import { localeNames, locales, type Locale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { cacheGet, cacheSet } from '@/shared/lib/cache';
import { getTimestamp } from '@/shared/lib/time';

const DISMISSED_KEY = 'locale-suggestion-dismissed';
const DISMISSED_EXPIRY_DAYS = 1; // Expiry in days
const PREFERRED_LOCALE_KEY = 'locale';

function detectBrowserLocale(): string | null {
  if (typeof window === 'undefined') return null;

  const nav = navigator as Navigator & { userLanguage?: string };
  const browserLang = nav.language || nav.userLanguage;
  if (!browserLang) {
    return null;
  }
  const normalized = browserLang === 'zh-CN' ? 'zh' : browserLang;

  // Prefer exact match first (e.g. pt-BR, zh-TW)
  if (locales.includes(normalized as Locale)) {
    return normalized;
  }

  // Handle common browser language codes that differ from our locale keys
  if (normalized === 'fil' || normalized === 'fil-PH' || normalized === 'tl') {
    return 'tl-PH';
  }
  if (normalized === 'nb' || normalized === 'nn') {
    return 'no';
  }
  if (normalized === 'iw') {
    return 'he';
  }
  if (normalized === 'in') {
    return 'id';
  }
  if (normalized === 'zh-HK' || normalized === 'zh-MO') {
    return 'zh-TW';
  }

  const langCode = normalized.split('-')[0].toLowerCase();

  // Check if the detected language is in our supported locales
  if (locales.includes(langCode as Locale)) {
    return langCode;
  }

  return null;
}

export function LocaleDetector() {
  const currentLocale = useLocale();
  const t = useTranslations('common.locale_detector');
  const router = useRouter();
  const pathname = usePathname();
  const [browserLocale] = useState<string | null>(() => detectBrowserLocale());
  const [showBanner, setShowBanner] = useState(() => {
    const dismissedData = cacheGet(DISMISSED_KEY);
    const dismissed = !!dismissedData;
    const preferredLocale = cacheGet(PREFERRED_LOCALE_KEY);

    return (
      !!browserLocale &&
      browserLocale !== currentLocale &&
      !dismissed &&
      !preferredLocale
    );
  });
  const bannerRef = useRef<HTMLDivElement>(null);
  const hasCheckedRef = useRef(false);

  const setDismissed = () => {
    const expiresAt = getTimestamp() + DISMISSED_EXPIRY_DAYS * 24 * 60 * 60;
    cacheSet(DISMISSED_KEY, 'true', expiresAt);
  };

  const switchToLocale = useCallback(
    (locale: string) => {
      router.replace(pathname, { locale });
      cacheSet(PREFERRED_LOCALE_KEY, locale);
    },
    [router, pathname]
  );

  useEffect(() => {
    // Only run initial check once to avoid interference with manual locale switches
    if (hasCheckedRef.current) {
      return;
    }

    hasCheckedRef.current = true;

    const preferredLocale = cacheGet(PREFERRED_LOCALE_KEY);

    // If user has previously clicked to switch locale, auto-switch to that preference
    if (
      preferredLocale &&
      preferredLocale !== currentLocale &&
      locales.includes(preferredLocale as Locale)
    ) {
      switchToLocale(preferredLocale);
      return;
    }
  }, [currentLocale, switchToLocale]);

  // Adjust header and main content position when banner is shown
  useEffect(() => {
    if (showBanner && bannerRef.current) {
      const bannerHeight = bannerRef.current.offsetHeight;

      // Adjust header if exists
      const header = document.querySelector('header');
      if (header) {
        header.style.top = `${bannerHeight}px`;
      }

      // Adjust sidebar container (fixed positioned sidebar)
      const sidebarContainer = document.querySelector(
        '[data-slot="sidebar-container"]'
      );
      if (sidebarContainer) {
        (sidebarContainer as HTMLElement).style.top = `${bannerHeight}px`;
        (sidebarContainer as HTMLElement).style.height =
          `calc(100vh - ${bannerHeight}px)`;
      }

      // Adjust sidebar wrapper (for dashboard/sidebar layouts)
      const sidebarWrapper = document.querySelector(
        '[data-slot="sidebar-wrapper"]'
      );
      if (sidebarWrapper) {
        (sidebarWrapper as HTMLElement).style.paddingTop = `${bannerHeight}px`;
      }
    }

    return () => {
      // Reset positions when component unmounts or banner is hidden
      const header = document.querySelector('header');
      if (header) {
        header.style.top = '0px';
      }

      const sidebarContainer = document.querySelector(
        '[data-slot="sidebar-container"]'
      );
      if (sidebarContainer) {
        (sidebarContainer as HTMLElement).style.top = '0px';
        (sidebarContainer as HTMLElement).style.height = '100vh';
      }

      const sidebarWrapper = document.querySelector(
        '[data-slot="sidebar-wrapper"]'
      );
      if (sidebarWrapper) {
        (sidebarWrapper as HTMLElement).style.paddingTop = '0px';
      }
    };
  }, [showBanner]);

  const handleSwitch = () => {
    if (browserLocale) {
      switchToLocale(browserLocale);
    }
  };

  const handleDismiss = () => {
    setDismissed();
    setShowBanner(false);

    // Reset header position
    const header = document.querySelector('header');
    if (header) {
      header.style.top = '0px';
    }

    // Reset sidebar container
    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]'
    );
    if (sidebarContainer) {
      (sidebarContainer as HTMLElement).style.top = '0px';
      (sidebarContainer as HTMLElement).style.height = '100vh';
    }

    // Reset sidebar wrapper padding
    const sidebarWrapper = document.querySelector(
      '[data-slot="sidebar-wrapper"]'
    );
    if (sidebarWrapper) {
      (sidebarWrapper as HTMLElement).style.paddingTop = '0px';
    }
  };

  if (!showBanner || !browserLocale) {
    return null;
  }

  const targetLocaleName =
    localeNames[browserLocale as keyof typeof localeNames] || browserLocale;

  return (
    <div
      ref={bannerRef}
      className="from-primary to-primary/80 text-primary-foreground fixed top-0 right-0 left-0 z-[51] bg-gradient-to-r shadow-lg"
    >
      <div className="container py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <span className="text-sm">
              {t('title', { locale: targetLocaleName })}
            </span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              onClick={handleSwitch}
              variant="secondary"
              size="sm"
              className="bg-background text-xs"
            >
              {t('switch_to', { locale: targetLocaleName })}
            </Button>
            <button
              onClick={handleDismiss}
              className="bg-primary/10 flex-shrink-0 rounded p-1 transition-colors"
              aria-label={t('dismiss_aria_label')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
