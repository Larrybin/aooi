import type { ReactNode } from 'react';

import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import { Footer, Header } from '@/themes/default/blocks';

export default async function LandingLayout({
  children,
  header,
  footer,
  publicConfig,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
  publicConfig: PublicUiConfig;
}) {
  return (
    <div className="h-screen w-screen">
      <Header header={header} publicConfig={publicConfig} />
      <main role="main">{children}</main>
      <Footer footer={footer} publicConfig={publicConfig} />
    </div>
  );
}
