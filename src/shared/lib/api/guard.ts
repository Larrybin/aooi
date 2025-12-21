/**
 * Usage:
 * - `requireUser(req)` for authentication (401) + CSRF (cookie + write requests).
 * - `requirePermission(userId, permissionCode)` for authorization (403).
 */

import 'server-only';

import { getUserInfo } from '@/shared/models/user';
import { hasPermission } from '@/shared/services/rbac';

import { assertCsrf } from './csrf.server';
import { ForbiddenError, UnauthorizedError } from './errors';

export async function requireUser(req: Request) {
  assertCsrf(req);
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
