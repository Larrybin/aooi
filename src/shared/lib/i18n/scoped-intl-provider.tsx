import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';

import type { Locale } from '@/config/locale';
import { getScopedMessages, normalizeLocale } from '@/core/i18n/messages';

export async function ScopedIntlProvider({
  children,
  locale,
  namespaces,
}: {
  children: ReactNode;
  locale: string;
  namespaces: string[];
}) {
  const resolvedLocale = normalizeLocale(locale);

  if (!resolvedLocale) {
    return <>{children}</>;
  }

  const messages = await getScopedMessages(
    resolvedLocale as Locale,
    namespaces
  );

  return (
    <NextIntlClientProvider locale={resolvedLocale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
