import type { ReactNode } from 'react';

import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
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
    <div className="min-h-screen w-full">
      <MarketingHeader
        header={header}
        locale={locale}
        publicConfigs={publicConfigs}
      />
      <main role="main">{children}</main>
      <MarketingFooter footer={footer} locale={locale} />
    </div>
  );
}
