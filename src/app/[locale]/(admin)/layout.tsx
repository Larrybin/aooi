// data: locale + signed-in user (RBAC) + admin sidebar translations
// cache: no-store (request-bound auth/RBAC)
// reason: admin area is user-specific; avoid caching across users/roles
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleDetector } from '@/shared/blocks/common';
import { DashboardLayout } from '@/shared/blocks/dashboard/layout';
import { AppContextProvider } from '@/shared/contexts/app';
import { toAuthSessionUserSnapshot } from '@/shared/lib/auth-session.server';
import { applyBrandToSidebar } from '@/shared/lib/brand-identity';
import { requireAdminAccess } from '@/shared/services/rbac_guard';
import type { Sidebar as SidebarType } from '@/shared/types/blocks/dashboard';

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

  const sidebarRaw: SidebarType = t.raw('sidebar');
  const sidebar = applyBrandToSidebar(sidebarRaw);

  return (
    <AppContextProvider>
      <DashboardLayout sidebar={sidebar} initialUser={initialUser}>
        <LocaleDetector />
        {children}
      </DashboardLayout>
    </AppContextProvider>
  );
}
