import type { ReactNode } from 'react';

import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { PublicAppProvider } from '@/shared/contexts/app';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

import { MarketingFooter } from '../blocks/marketing-footer';
import { MarketingHeader } from '../blocks/marketing-header';

export default async function LandingMarketingLayout({
  children,
  header,
  footer,
  locale,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
  locale: string;
}) {
  const publicConfigs = await getPublicConfigsCached();

  return (
    <ScopedIntlProvider locale={locale} namespaces={['common.sign']}>
      <PublicAppProvider initialConfigs={publicConfigs}>
        <div className="min-h-screen w-full">
          <MarketingHeader
            header={header}
            locale={locale}
            publicConfigs={publicConfigs}
          />
          <main role="main">{children}</main>
          <MarketingFooter
            footer={footer}
            locale={locale}
            publicConfigs={publicConfigs}
          />
        </div>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
