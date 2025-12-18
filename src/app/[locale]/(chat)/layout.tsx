import { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ChatLibrary } from '@/shared/blocks/chat/library';
import { LocaleDetector } from '@/shared/blocks/common';
import { DashboardLayout } from '@/shared/blocks/dashboard';
import { ChatContextProvider } from '@/shared/contexts/chat';
import { Sidebar as SidebarType } from '@/shared/types/blocks/dashboard';

export default async function ChatLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('ai.chat');
  const sidebar: SidebarType = t.raw('sidebar');

  sidebar.library = <ChatLibrary />;

  return (
    <ChatContextProvider>
      <DashboardLayout sidebar={sidebar}>
        <LocaleDetector />
        {children}
      </DashboardLayout>
    </ChatContextProvider>
  );
}
