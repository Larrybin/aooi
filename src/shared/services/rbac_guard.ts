import 'server-only';

import { redirect } from '@/core/i18n/navigation';
import { hasAnyRole, hasRole } from '@/core/rbac';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';
import { getPermissionCheckerForRequest } from '@/shared/services/rbac_request_cache';

export { PERMISSIONS };

/**
 * Permission guard error
 */
export class PermissionDeniedError extends Error {
  constructor(message = 'Permission denied') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

type RedirectContext = {
  redirectUrl?: string;
  locale?: string;
};

function redirectTo(href: string, locale?: string): void {
  redirect({ href, locale: locale || '' });
}

function redirectIfProvided({ redirectUrl, locale }: RedirectContext): void {
  if (!redirectUrl) return;
  redirectTo(redirectUrl, locale);
}

function deny(
  message: string,
  { redirectUrl, locale }: RedirectContext
): never {
  redirectIfProvided({ redirectUrl, locale });
  throw new PermissionDeniedError(message);
}

async function requireSignedInUser(ctx: RedirectContext) {
  const user = await getSignedInUserIdentity();
  if (!user) {
    deny('User not authenticated', ctx);
  }
  return user;
}

/**
 * Check if user can access admin area
 */
export async function canAccessAdmin(userId: string): Promise<boolean> {
  return getPermissionCheckerForRequest(userId).has(PERMISSIONS.ADMIN_ACCESS);
}

/**
 * Check if current user has permission, throw error if not
 */
export async function requirePermission({
  code,
  redirectUrl,
  locale,
}: {
  code: string;
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await requireSignedInUser({ redirectUrl, locale });
  const allowed = await getPermissionCheckerForRequest(user.id).has(code);

  if (!allowed) {
    deny(`Permission required: ${code}`, { redirectUrl, locale });
  }
}

/**
 * Check if current user has any of the permissions, throw error if not
 */
export async function requireAnyPermission({
  codes,
  redirectUrl,
  locale,
}: {
  codes: string[];
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await requireSignedInUser({ redirectUrl, locale });
  const allowed = await getPermissionCheckerForRequest(user.id).hasAny(codes);

  if (!allowed) {
    deny(`Any of these permissions required: ${codes.join(', ')}`, {
      redirectUrl,
      locale,
    });
  }
}

/**
 * Check if current user has all of the permissions, throw error if not
 */
export async function requireAllPermissions({
  codes,
  redirectUrl,
  locale,
}: {
  codes: string[];
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await requireSignedInUser({ redirectUrl, locale });
  const allowed = await getPermissionCheckerForRequest(user.id).hasAll(codes);

  if (!allowed) {
    deny(`All of these permissions required: ${codes.join(', ')}`, {
      redirectUrl,
      locale,
    });
  }
}

/**
 * Check if current user has role, throw error if not
 */
export async function requireRole({
  roleName,
  redirectUrl,
  locale,
}: {
  roleName: string;
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await requireSignedInUser({ redirectUrl, locale });
  const allowed = await hasRole(user.id, roleName);

  if (!allowed) {
    deny(`Role required: ${roleName}`, { redirectUrl, locale });
  }
}

/**
 * Check if current user has any of the roles, throw error if not
 */
export async function requireAnyRole({
  roleNames,
  redirectUrl,
  locale,
}: {
  roleNames: string[];
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await requireSignedInUser({ redirectUrl, locale });
  const allowed = await hasAnyRole(user.id, roleNames);

  if (!allowed) {
    deny(`Any of these roles required: ${roleNames.join(', ')}`, {
      redirectUrl,
      locale,
    });
  }
}

/**
 * Check if current user can access admin area
 */
export async function requireAdminAccess({
  redirectUrl,
  locale,
}: {
  redirectUrl?: string;
  locale?: string;
}): Promise<unknown> {
  const user = await getSignedInUserIdentity();
  if (!user) {
    redirectTo('/sign-in', locale);
  }

  const allowed = await canAccessAdmin(user!.id);
  if (!allowed) {
    deny(`Permission required: ${PERMISSIONS.ADMIN_ACCESS}`, {
      redirectUrl,
      locale,
    });
  }

  return user;
}

/**
 * Get current user with permission check
 * Returns null if user doesn't have permission
 */
export async function getCurrentUserWithPermission({
  code,
}: {
  code: string;
  locale?: string;
}): Promise<AuthSessionUserIdentity | null> {
  const user = await getSignedInUserIdentity();
  if (!user) return null;

  const allowed = await getPermissionCheckerForRequest(user.id).has(code);
  if (!allowed) return null;

  return user;
}

/**
 * Check page access permissions
 * Returns true if user has access, false otherwise
 */
export async function checkPageAccess({
  codes,
}: {
  codes: string[];
  locale?: string;
}): Promise<boolean> {
  const user = await getSignedInUserIdentity();
  if (!user) return false;

  return getPermissionCheckerForRequest(user.id).hasAny(codes);
}

/**
 * Higher-order function for API routes with permission check
 */
export function withPermission<T extends (...args: unknown[]) => unknown>(
  handler: T,
  {
    code,
    locale,
  }: {
    code: string;
    locale?: string;
  }
): T {
  return (async (...args: Parameters<T>) => {
    await requirePermission({ code, locale });
    return handler(...args);
  }) as T;
}

/**
 * Higher-order function for API routes with role check
 */
export function withRole<T extends (...args: unknown[]) => unknown>(
  handler: T,
  {
    roleName,
    locale,
  }: {
    roleName: string;
    locale?: string;
  }
): T {
  return (async (...args: Parameters<T>) => {
    await requireRole({ roleName, locale });
    return handler(...args);
  }) as T;
}
