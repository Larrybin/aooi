// data: locale + signed-in user (RBAC) + admin sidebar translations
// cache: no-store (request-bound auth/RBAC)
// reason: admin area is user-specific; avoid caching across users/roles
import type { ReactNode } from 'react';
import { SignModal } from '@/domains/account/ui/auth/sign-modal';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { WorkspaceLayout } from '@/shared/blocks/workspace/layout';
import { PublicAppProvider } from '@/shared/contexts/app';
import { AuthSnapshotProvider } from '@/shared/contexts/auth-snapshot';
import { toAuthSessionUserSnapshot } from '@/infra/platform/auth/user-snapshot';
import { applyBrandToSidebar } from '@/infra/platform/brand/identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { filterLandingNavItems } from '@/surfaces/public/navigation/landing-visibility';
import {
  readAuthUiRuntimeSettingsCached,
  readBillingRuntimeSettingsCached,
  readPublicUiConfigCached,
} from '@/domains/settings/application/settings-runtime.query';
import { requireAdminPageAccess } from './_guards/page-access';
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
  const signedInUser = await requireAdminPageAccess({
    redirectUrl: `/admin/no-permission`,
    locale: locale || '',
  });

  const initialUser = toAuthSessionUserSnapshot(signedInUser);

  const t = await getTranslations('admin.sidebar');

  const [publicUiConfig, authSettings, billingSettings] = await Promise.all([
    readPublicUiConfigCached(),
    readAuthUiRuntimeSettingsCached(),
    readBillingRuntimeSettingsCached(),
  ]);
  const brand = buildBrandPlaceholderValues();
  const sidebarRaw: SidebarType = replaceBrandPlaceholdersDeep(
    {
      header: t.raw('header'),
      main_navs: t.raw('main_navs'),
      bottom_nav: t.raw('bottom_nav'),
      user: t.raw('user'),
      footer: t.raw('footer'),
      variant: t.raw('variant'),
    },
    brand
  );
  const sidebar = applyBrandToSidebar(sidebarRaw);
  const filteredSidebar: SidebarType = {
    ...sidebar,
    main_navs: sidebar.main_navs
      ?.map((nav) => ({
        ...nav,
        items: filterLandingNavItems(nav.items, publicUiConfig),
      }))
      .filter((nav) => nav.items.length > 0),
    bottom_nav: sidebar.bottom_nav
      ? {
          ...sidebar.bottom_nav,
          items: filterLandingNavItems(sidebar.bottom_nav.items, publicUiConfig),
        }
      : sidebar.bottom_nav,
    user: sidebar.user?.nav
      ? {
          ...sidebar.user,
          nav: {
            ...sidebar.user.nav,
            items: filterLandingNavItems(sidebar.user.nav.items, publicUiConfig),
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
              publicUiConfig
            ),
          },
        }
      : sidebar.footer,
  };

  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={[
        'common.sign',
        'common.locale_switcher',
        'common.locale_detector',
        'common.uploader.image',
        'admin.settings',
      ]}
    >
      <PublicAppProvider
        initialUiConfig={publicUiConfig}
        initialAuthSettings={authSettings}
        initialBillingSettings={billingSettings}
      >
        <AuthSnapshotProvider initialSnapshot={initialUser}>
          <WorkspaceLayout sidebar={filteredSidebar} initialUser={initialUser}>
            <LocaleDetector />
            {children}
          </WorkspaceLayout>
          <SignModal callbackUrl={filteredSidebar.user?.signin_callback || '/'} />
        </AuthSnapshotProvider>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
