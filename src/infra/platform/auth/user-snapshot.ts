import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';

type SessionUserLike = {
  name?: unknown;
  email?: unknown;
  image?: unknown;
};

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
