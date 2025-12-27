import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleDetector } from '@/shared/blocks/common';
import { DashboardLayout } from '@/shared/blocks/dashboard/layout';
import { AppContextProvider } from '@/shared/contexts/app';
import { toAuthSessionUserSnapshot } from '@/shared/lib/auth-session.server';
import { applyBrandToSidebar } from '@/shared/lib/brand-identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
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

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const sidebarRaw: SidebarType = replaceBrandPlaceholdersDeep(
    t.raw('sidebar'),
    brand
  );
  const sidebar = applyBrandToSidebar(sidebarRaw, publicConfigs);

  return (
    <AppContextProvider>
      <DashboardLayout sidebar={sidebar} initialUser={initialUser}>
        <LocaleDetector />
        {children}
      </DashboardLayout>
    </AppContextProvider>
  );
}
