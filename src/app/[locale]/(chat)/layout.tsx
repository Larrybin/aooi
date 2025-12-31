// data: locale + signed-in user snapshot (better-auth) + chat sidebar translations
// cache: no-store (request-bound auth)
// reason: chat layout is user-specific; avoid caching across users
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ChatLibrary } from '@/shared/blocks/chat/library';
import { LocaleDetector } from '@/shared/blocks/common';
import { DashboardLayout } from '@/shared/blocks/dashboard';
import { AppContextProvider } from '@/shared/contexts/app';
import { ChatContextProvider } from '@/shared/contexts/chat';
import { getSignedInUserSnapshot } from '@/shared/lib/auth-session.server';
import { applyBrandToSidebar } from '@/shared/lib/brand-identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { isAiEnabled } from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import type { Sidebar as SidebarType } from '@/shared/types/blocks/dashboard';

export default async function ChatLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const publicConfigs = await getPublicConfigsCached();
  if (!isAiEnabled(publicConfigs)) {
    notFound();
  }
  const brand = buildBrandPlaceholderValues(publicConfigs);

  const t = await getTranslations('ai.chat');
  const sidebarRaw: SidebarType = replaceBrandPlaceholdersDeep(
    t.raw('sidebar'),
    brand
  );
  const sidebar: SidebarType = applyBrandToSidebar(sidebarRaw, publicConfigs);

  sidebar.library = <ChatLibrary />;
  const initialUser = await getSignedInUserSnapshot();

  return (
    <AppContextProvider>
      <ChatContextProvider>
        <DashboardLayout sidebar={sidebar} initialUser={initialUser}>
          <LocaleDetector />
          {children}
        </DashboardLayout>
      </ChatContextProvider>
    </AppContextProvider>
  );
}
