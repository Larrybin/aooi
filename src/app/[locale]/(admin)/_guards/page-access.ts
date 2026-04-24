import 'server-only';

import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { redirect } from '@/infra/platform/i18n/navigation';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

type RedirectContext = {
  redirectUrl?: string;
  locale?: string;
};

function redirectTo(href: string, locale?: string): never {
  redirect({ href, locale: locale || '' });
  throw new Error('redirect() should be unreachable');
}

export async function requirePagePermission({
  code,
  redirectUrl,
  locale,
}: {
  code: string;
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignedInUserIdentity();
  if (!user) {
    redirectTo('/sign-in', locale);
  }

  const allowed = await accessControlRuntimeDeps
    .getPermissionCheckerForRequest(user.id)
    .has(code);

  if (!allowed) {
    redirectTo(redirectUrl ?? '/no-permission', locale);
  }
}

export async function requireAllPagePermissions({
  codes,
  redirectUrl,
  locale,
}: {
  codes: string[];
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignedInUserIdentity();
  if (!user) {
    redirectTo('/sign-in', locale);
  }

  const allowed = await accessControlRuntimeDeps
    .getPermissionCheckerForRequest(user.id)
    .hasAll(codes);

  if (!allowed) {
    redirectTo(redirectUrl ?? '/no-permission', locale);
  }
}

export async function requireAnyPagePermission({
  codes,
  redirectUrl,
  locale,
}: {
  codes: string[];
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignedInUserIdentity();
  if (!user) {
    redirectTo('/sign-in', locale);
  }

  const allowed = await accessControlRuntimeDeps
    .getPermissionCheckerForRequest(user.id)
    .hasAny(codes);

  if (!allowed) {
    redirectTo(redirectUrl ?? '/no-permission', locale);
  }
}

export async function requireAdminPageAccess({
  redirectUrl,
  locale,
}: RedirectContext): Promise<
  NonNullable<Awaited<ReturnType<typeof getSignedInUserIdentity>>>
> {
  const user = await getSignedInUserIdentity();
  if (!user) {
    redirectTo('/sign-in', locale);
  }

  const allowed = await accessControlRuntimeDeps
    .getPermissionCheckerForRequest(user.id)
    .has(PERMISSIONS.ADMIN_ACCESS);

  if (!allowed) {
    redirectTo(redirectUrl ?? '/admin/no-permission', locale);
  }

  return user;
}
