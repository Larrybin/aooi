import { cache } from 'react';
import { readSessionTokenFromCookieHeader } from '@/infra/platform/auth/session-cookie';
import { toAuthSessionUserSnapshot } from '@/infra/platform/auth/user-snapshot';

import type {
  AuthSessionUserIdentity,
  AuthSessionUserSnapshot,
} from '@/shared/types/auth-session';

type CacheFunction = <Args extends unknown[], Result>(
  fn: (...args: Args) => Result
) => (...args: Args) => Result;

type ReadSignedInUserIdentityBySessionToken = (
  sessionToken: string
) => Promise<AuthSessionUserIdentity | null>;

export async function readSignedInUserIdentityFromCookieHeader(
  cookieHeader: string | null,
  readIdentityBySessionToken: ReadSignedInUserIdentityBySessionToken
): Promise<AuthSessionUserIdentity | null> {
  const sessionToken = readSessionTokenFromCookieHeader(cookieHeader);
  if (!sessionToken) {
    return null;
  }

  return readIdentityBySessionToken(sessionToken);
}

export function createRequestScopedAuthSessionReader(
  readIdentityBySessionToken: ReadSignedInUserIdentityBySessionToken,
  cacheFunction: CacheFunction = cache
) {
  const readIdentityForCookieHeader = cacheFunction(
    (cookieHeader: string | null) =>
      readSignedInUserIdentityFromCookieHeader(
        cookieHeader,
        readIdentityBySessionToken
      )
  );

  return {
    getIdentity(cookieHeader: string | null) {
      return readIdentityForCookieHeader(cookieHeader);
    },
    async getSnapshot(
      cookieHeader: string | null
    ): Promise<AuthSessionUserSnapshot | null> {
      return toAuthSessionUserSnapshot(
        await readIdentityForCookieHeader(cookieHeader)
      );
    },
  };
}
