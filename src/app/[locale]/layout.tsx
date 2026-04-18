// data: locale param + i18n messages (next-intl) + UI providers (toaster)
// cache: default (no explicit fetch); scoped per `[locale]` segment
// reason: keep the locale shell cache-friendly; avoid request headers/cookies here
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { routing } from '@/core/i18n/config';
import { HtmlLangProvider } from '@/core/i18n/html-lang-provider';
import { Toaster } from '@/shared/components/ui/sonner';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getAllConfigsSafe } from '@/shared/models/config';

export async function generateMetadata(): Promise<Metadata> {
  const { configs } = await getAllConfigsSafe();
  const brand = buildBrandPlaceholderValues(configs);

  return {
    metadataBase: new URL(envConfigs.app_url),
    title: {
      default: brand.appName,
      template: `%s | ${brand.appName}`,
    },
    icons: {
      icon: brand.appFavicon,
      shortcut: brand.appFavicon,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={null}>
      <HtmlLangProvider>
        {children}
        <Toaster position="top-center" richColors />
      </HtmlLangProvider>
    </NextIntlClientProvider>
  );
}
