import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { i18n } from '@/core/docs/source';

export function baseOptions(
  _locale: string,
  brand?: { appName?: string }
): BaseLayoutProps {
  const appName = brand?.appName || '';
  return {
    links: [],
    nav: {
      title: (
        <>
          <Image
            src="/logo.png"
            alt={appName}
            width={28}
            height={28}
            className=""
          />
          <span className="text-primary text-lg font-bold">
            {appName}
          </span>
        </>
      ),
      transparentMode: 'top',
    },
    i18n,
  };
}
