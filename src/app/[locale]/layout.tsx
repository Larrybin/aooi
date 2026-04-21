// data: locale param + i18n messages (next-intl) + UI providers (toaster)
// cache: default (no explicit fetch); scoped per `[locale]` segment
// reason: keep the locale shell cache-friendly; avoid request headers/cookies here
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { routing } from '@/infra/platform/i18n/config';
import { HtmlLangProvider } from '@/infra/platform/i18n/html-lang-provider';
import { Toaster } from '@/shared/components/ui/sonner';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';
import { readRuntimeSettingsSafe } from '@/domains/settings/application/settings-runtime.query';

export async function generateMetadata(): Promise<Metadata> {
  const { configs } = await readRuntimeSettingsSafe();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();
  const brand = buildBrandPlaceholderValues(configs);

  return {
    metadataBase: new URL(serverPublicEnvConfigs.app_url),
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
