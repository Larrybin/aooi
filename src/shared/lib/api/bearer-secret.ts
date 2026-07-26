/**
 * Usage:
 * - Guard machine-to-machine Route Handlers (cron/cleanup) that authenticate with
 *   a shared secret: `assertBearerSecret(req, 'REMOVER_CLEANUP_SECRET')`.
 */

import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { ForbiddenError, NotFoundError } from './errors';

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
};

/**
 * Rejects requests that do not carry `Authorization: Bearer <secret>`.
 *
 * - Unconfigured secret answers 404 so an unprovisioned endpoint stays indistinguishable
 *   from a route that does not exist.
 * - Comparison is constant time so the secret cannot be recovered byte by byte from
 *   response timing.
 */
export function assertBearerSecret(req: Request, envName: string): void {
  const secret = getRuntimeEnvString(envName)?.trim() || '';
  if (!secret) {
    throw new NotFoundError('not found');
  }

  const authorization = req.headers.get('authorization')?.trim() || '';
  if (!constantTimeEqual(authorization, `Bearer ${secret}`)) {
    throw new ForbiddenError('forbidden');
  }
}
