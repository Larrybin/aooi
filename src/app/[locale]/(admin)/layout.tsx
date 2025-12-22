import { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleDetector } from '@/shared/blocks/common';
import { DashboardLayout } from '@/shared/blocks/dashboard/layout';
import { AppContextProvider } from '@/shared/contexts/app';
import { toAuthSessionUserSnapshot } from '@/shared/lib/auth-session.server';
import { requireAdminAccess } from '@/shared/services/rbac_guard';
import { Sidebar as SidebarType } from '@/shared/types/blocks/dashboard';

/**
 * Admin layout to manage datas
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Check if user has admin access permission
  const signedInUser = await requireAdminAccess({
    redirectUrl: `/no-permission`,
    locale: locale || '',
  });

  const initialUser = toAuthSessionUserSnapshot(signedInUser);

  const t = await getTranslations('admin');

  const sidebar: SidebarType = t.raw('sidebar');

  return (
    <AppContextProvider>
      <DashboardLayout sidebar={sidebar} initialUser={initialUser}>
        <LocaleDetector />
        {children}
      </DashboardLayout>
    </AppContextProvider>
  );
}
