import 'server-only';

import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';
import { toAuthSessionUserSnapshot } from '@/shared/lib/auth-user-snapshot';

export async function getSignedInUser() {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user;
}

export async function getSignedInUserSnapshot(): Promise<AuthSessionUserSnapshot | null> {
  return toAuthSessionUserSnapshot(await getSignedInUser());
}
