import 'server-only';

import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';

export async function getSignedInUser() {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user;
}

