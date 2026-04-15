import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { docsI18n } from '@/core/docs/source';
import { envConfigs } from '@/config';
import { BrandImage } from '@/shared/blocks/common/brand-image';

export function baseOptions(
  _locale: string,
  brand?: { appName?: string; appLogo?: string }
): BaseLayoutProps {
  const appName = brand?.appName || '';
  const appLogo = brand?.appLogo || envConfigs.app_logo;
  return {
    themeSwitch: {
      enabled: false,
    },
    links: [],
    nav: {
      title: (
        <>
          <BrandImage
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
