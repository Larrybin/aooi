import 'server-only';

import { cache } from 'react';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { getUserInfo } from '@/shared/models/user';
import { createPermissionChecker } from '@/shared/services/rbac';

import { ActionError } from './errors';

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const getPermissionCheckerForRequest = cache((userId: string) =>
  createPermissionChecker(userId)
);

export async function requireActionUser() {
  const user = await getUserInfo();
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
