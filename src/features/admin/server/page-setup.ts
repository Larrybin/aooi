import 'server-only';

import { setRequestLocale } from 'next-intl/server';

import type { PermissionCode } from '@/shared/lib/action/guard';
import { requirePermission } from '@/shared/services/rbac_guard';

/**
 * Setup admin page with locale and permission check
 *
 * @example
 * ```ts
 * await setupAdminPage({
 *   locale,
 *   permission: PERMISSIONS.CATEGORIES_WRITE,
 * });
 * ```
 */
export async function setupAdminPage({
  locale,
  permission,
  redirectUrl = '/admin/no-permission',
}: {
  locale: string;
  permission: PermissionCode;
  redirectUrl?: string;
}) {
  setRequestLocale(locale);
  await requirePermission({ code: permission, redirectUrl, locale });
}
