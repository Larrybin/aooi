/**
 * Usage:
 * - `requireUser()` for authentication (401).
 * - `requirePermission(userId, permissionCode)` for authorization (403).
 */

import 'server-only';

import { getUserInfo } from '@/shared/models/user';
import { hasPermission } from '@/shared/services/rbac';

import { ForbiddenError, UnauthorizedError } from './errors';

export async function requireUser() {
  const user = await getUserInfo();
  if (!user) {
    throw new UnauthorizedError('no auth, please sign in');
  }
  return user;
}

export async function requirePermission(userId: string, code: string) {
  const allowed = await hasPermission(userId, code);
  if (!allowed) {
    throw new ForbiddenError('no permission');
  }
}
