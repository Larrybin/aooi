// data: locale + signed-in user snapshot (better-auth) + chat sidebar translations
// cache: no-store (request-bound auth)
// reason: chat layout is user-specific; avoid caching across users
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { SignModal } from '@/domains/account/ui/auth/sign-modal';
import { ChatLibrary } from '@/domains/chat/ui/library';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { WorkspaceLayout } from '@/shared/blocks/workspace';
import { PublicAppProvider } from '@/shared/contexts/app';
import { AuthSnapshotProvider } from '@/shared/contexts/auth-snapshot';
import { ChatContextProvider } from '@/shared/contexts/chat';
import { getSignedInUserSnapshot } from '@/infra/platform/auth/session.server';
import { applyBrandToSidebar } from '@/infra/platform/brand/identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  readAuthUiRuntimeSettingsCached,
  readBillingRuntimeSettingsCached,
  readPublicUiConfigCached,
} from '@/domains/settings/application/settings-runtime.query';
import type { Sidebar as SidebarType } from '@/shared/types/blocks/workspace';

export default async function ChatLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [publicUiConfig, authSettings, billingSettings] = await Promise.all([
    readPublicUiConfigCached(),
    readAuthUiRuntimeSettingsCached(),
    readBillingRuntimeSettingsCached(),
  ]);
  if (!isAiEnabled(publicUiConfig)) {
    notFound();
  }
  const brand = buildBrandPlaceholderValues();

  const t = await getTranslations('ai.chat');
  const sidebarRaw: SidebarType = replaceBrandPlaceholdersDeep(
    t.raw('sidebar'),
    brand
  );
  const sidebar: SidebarType = applyBrandToSidebar(sidebarRaw);

  sidebar.library = <ChatLibrary />;
  const initialUser = await getSignedInUserSnapshot();

  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={[
        'common.sign',
        'common.locale_switcher',
        'common.locale_detector',
        'ai.chat',
      ]}
    >
      <PublicAppProvider
        initialUiConfig={publicUiConfig}
        initialAuthSettings={authSettings}
        initialBillingSettings={billingSettings}
      >
        <AuthSnapshotProvider initialSnapshot={initialUser}>
          <ChatContextProvider>
            <WorkspaceLayout sidebar={sidebar} initialUser={initialUser}>
              <LocaleDetector />
              {children}
            </WorkspaceLayout>
            <SignModal callbackUrl={sidebar.user?.signin_callback || '/'} />
          </ChatContextProvider>
        </AuthSnapshotProvider>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
