import 'server-only';

import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';

type SessionUserLike = {
  name?: unknown;
  email?: unknown;
  image?: unknown;
};

export async function getSignedInUser() {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function toAuthSessionUserSnapshot(
  user: unknown
): AuthSessionUserSnapshot | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const candidate = user as SessionUserLike;
  return {
    name: toNullableString(candidate.name),
    email: toNullableString(candidate.email),
    image: toNullableString(candidate.image),
  };
}

export async function getSignedInUserSnapshot(): Promise<AuthSessionUserSnapshot | null> {
  return toAuthSessionUserSnapshot(await getSignedInUser());
}
