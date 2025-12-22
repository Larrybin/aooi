import { ReactNode } from 'react';

import {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import { Footer, Header } from '@/themes/default/blocks';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

export default async function LandingLayout({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
}) {
  const publicConfigs = await getPublicConfigsCached();

  return (
    <div className="h-screen w-screen">
      <Header header={header} publicConfigs={publicConfigs} />
      <main role="main">{children}</main>
      <Footer footer={footer} publicConfigs={publicConfigs} />
    </div>
  );
}
