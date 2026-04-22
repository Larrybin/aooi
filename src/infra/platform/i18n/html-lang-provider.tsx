'use client';

import { useEffect, type ReactNode } from 'react';
import { useLocale } from 'next-intl';

import { isRtlLocale } from '@/config/locale';

export function HtmlLangProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();

  useEffect(() => {
    const nextDir = isRtlLocale(locale) ? 'rtl' : 'ltr';

    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }

    if (document.documentElement.dir !== nextDir) {
      document.documentElement.dir = nextDir;
    }
  }, [locale]);

  return <>{children}</>;
}
