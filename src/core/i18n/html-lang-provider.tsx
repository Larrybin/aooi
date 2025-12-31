'use client';

import { useEffect, type ReactNode } from 'react';
import { useLocale } from 'next-intl';

// Root <html> in `src/app/layout.tsx` stays mounted across client navigations; keep `lang` in sync with locale changes.
export function HtmlLangProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();

  useEffect(() => {
    if (document.documentElement.lang === locale) return;
    document.documentElement.lang = locale;
  }, [locale]);

  return <>{children}</>;
}
