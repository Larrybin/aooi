/**
 * Usage:
 * - `requireUser(req)` for authentication (401) + CSRF (cookie + write requests).
 * - `requirePermission(userId, permissionCode)` for authorization (403).
 */

import 'server-only';

import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import { assertCsrf } from '@/shared/lib/api/csrf.server';
import {
  ForbiddenError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';

import { accessControlRuntimeDeps } from './runtime-deps';

export async function requireUser(
  req: Request
): Promise<AuthSessionUserIdentity> {
  assertCsrf(req);
  const user = await getSignedInUserIdentity();
  if (!user) {
    throw new UnauthorizedError('no auth, please sign in');
  }
  return user;
}

export async function requirePermission(
  userId: string,
  code: string
): Promise<void> {
  const allowed = await accessControlRuntimeDeps.checkUserPermission(
    userId,
    code
  );
  if (!allowed) {
    throw new ForbiddenError('no permission');
  }
}
