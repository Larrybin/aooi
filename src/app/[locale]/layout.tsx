// data: locale param + i18n messages (next-intl) + UI providers (toaster)
// cache: default (no explicit fetch); scoped per `[locale]` segment
// reason: keep the locale shell cache-friendly; avoid request headers/cookies here
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { routing } from '@/core/i18n/config';
import { HtmlLangProvider } from '@/core/i18n/html-lang-provider';
import { Toaster } from '@/shared/components/ui/sonner';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata();

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
    <NextIntlClientProvider locale={locale}>
      <HtmlLangProvider>
        {children}
        <Toaster position="top-center" richColors />
      </HtmlLangProvider>
    </NextIntlClientProvider>
  );
}
