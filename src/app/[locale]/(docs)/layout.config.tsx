import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { docsI18n } from '@/domains/content/application/docs-content.query';
import { AppImage } from '@/shared/blocks/common/app-image';
import { site } from '@/site';

export function baseOptions(
  _locale: string,
  brand?: { appName?: string; appLogo?: string }
): BaseLayoutProps {
  const appName = brand?.appName || site.brand.appName;
  const appLogo = brand?.appLogo || site.brand.logo;
  return {
    themeSwitch: {
      enabled: false,
    },
    links: [],
    nav: {
      title: (
        <>
          <AppImage
            src={appLogo}
            alt={appName}
            width={28}
            height={28}
            className=""
          />
          <span className="text-primary text-lg font-bold">{appName}</span>
        </>
      ),
      transparentMode: 'top',
    },
    i18n: docsI18n,
  };
}
