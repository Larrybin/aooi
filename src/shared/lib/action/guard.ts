import 'server-only';

import type { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import { getPermissionCheckerForRequest } from '@/shared/services/rbac_request_cache';

import { ActionError } from './errors';

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export async function requireActionUser() {
  const user = await getSignedInUserIdentity();
  if (!user) {
    throw new ActionError('no auth');
  }
  return user;
}

export async function requireActionPermission(
  userId: string,
  code: PermissionCode
) {
  const allowed = await getPermissionCheckerForRequest(userId).has(code);
  if (!allowed) {
    throw new ActionError('no permission');
  }
}

export async function requireActionPermissions(
  userId: string,
  ...codes: PermissionCode[]
) {
  const allowed = await getPermissionCheckerForRequest(userId).hasAll(codes);
  if (!allowed) {
    throw new ActionError('no permission');
  }
}

export async function requireActionAnyPermissions(
  userId: string,
  ...codes: PermissionCode[]
) {
  const allowed = await getPermissionCheckerForRequest(userId).hasAny(codes);
  if (!allowed) {
    throw new ActionError('no permission');
  }
}
