// data: locale + signed-in user (RBAC) + admin sidebar translations
// cache: no-store (request-bound auth/RBAC)
// reason: admin area is user-specific; avoid caching across users/roles
import type { ReactNode } from 'react';
import { SignModal } from '@/features/web/auth/components/sign-modal';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleDetector } from '@/shared/blocks/common';
import { WorkspaceLayout } from '@/shared/blocks/workspace/layout';
import { AppContextProvider } from '@/shared/contexts/app';
import { toAuthSessionUserSnapshot } from '@/shared/lib/auth-session.server';
import { applyBrandToSidebar } from '@/shared/lib/brand-identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { filterLandingNavItems } from '@/shared/lib/landing-visibility';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import { requireAdminAccess } from '@/shared/services/rbac_guard';
import type { Sidebar as SidebarType } from '@/shared/types/blocks/workspace';

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
  const filteredSidebar: SidebarType = {
    ...sidebar,
    main_navs: sidebar.main_navs
      ?.map((nav) => ({
        ...nav,
        items: filterLandingNavItems(nav.items, publicConfigs),
      }))
      .filter((nav) => nav.items.length > 0),
    bottom_nav: sidebar.bottom_nav
      ? {
          ...sidebar.bottom_nav,
          items: filterLandingNavItems(sidebar.bottom_nav.items, publicConfigs),
        }
      : sidebar.bottom_nav,
    user: sidebar.user?.nav
      ? {
          ...sidebar.user,
          nav: {
            ...sidebar.user.nav,
            items: filterLandingNavItems(sidebar.user.nav.items, publicConfigs),
          },
        }
      : sidebar.user,
    footer: sidebar.footer?.nav
      ? {
          ...sidebar.footer,
          nav: {
            ...sidebar.footer.nav,
            items: filterLandingNavItems(
              sidebar.footer.nav.items,
              publicConfigs
            ),
          },
        }
      : sidebar.footer,
  };

  return (
    <AppContextProvider>
      <WorkspaceLayout sidebar={filteredSidebar} initialUser={initialUser}>
        <LocaleDetector />
        {children}
      </WorkspaceLayout>
      <SignModal callbackUrl={filteredSidebar.user?.signin_callback || '/'} />
    </AppContextProvider>
  );
}
