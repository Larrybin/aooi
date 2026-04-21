import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { docsI18n } from '@/core/docs/source';
import { AppImage } from '@/shared/blocks/common/app-image';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';

export function baseOptions(
  _locale: string,
  brand?: { appName?: string; appLogo?: string }
): BaseLayoutProps {
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();
  const appName = brand?.appName || '';
  const appLogo = brand?.appLogo || serverPublicEnvConfigs.app_logo;
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
