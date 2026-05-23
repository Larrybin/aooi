import {
  buildGuestSessionCookie,
  readGuestSession,
  resolveGuestSession,
  writeGuestSessionCookie,
  type GuestSessionResult,
} from '@/domains/product-access/application/guest-session.contracts';

export const REMOVER_ANONYMOUS_SESSION_COOKIE = 'remover_anon';
export const REMOVER_ANONYMOUS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type AnonymousSessionOptions = {
  secret?: string;
  createId?: () => string;
};

type AnonymousSessionResult = {
  anonymousSessionId: string;
  cookieValue: string;
  shouldSetCookie: boolean;
};

export async function buildAnonymousSessionCookie({
  anonymousSessionId,
  secret,
}: {
  anonymousSessionId: string;
  secret: string;
}): Promise<string> {
  return buildGuestSessionCookie({ anonymousSessionId, secret });
}

export async function resolveAnonymousSessionForRequest(
  req: Request,
  options: AnonymousSessionOptions = {}
): Promise<AnonymousSessionResult> {
  return resolveGuestSession(req, {
    cookieName: REMOVER_ANONYMOUS_SESSION_COOKIE,
    secret: options.secret,
    createId: options.createId,
  });
}

export async function readAnonymousSessionIdFromRequest(
  req: Request,
  options: Pick<AnonymousSessionOptions, 'secret'> = {}
): Promise<string | null> {
  const session = await readGuestSession(req, {
    cookieName: REMOVER_ANONYMOUS_SESSION_COOKIE,
    secret: options.secret,
  });
  return session?.anonymousSessionId ?? null;
}

export async function resolveAnonymousSessionIdForRequest(
  req: Request,
  options: AnonymousSessionOptions = {}
): Promise<string> {
  const session = await resolveAnonymousSessionForRequest(req, options);
  return session.anonymousSessionId;
}

export function writeAnonymousSessionCookie({
  cookieStore,
  req,
  session,
}: {
  cookieStore: {
    set: Parameters<typeof writeGuestSessionCookie>[0]['cookieStore']['set'];
  };
  req: Request;
  session: GuestSessionResult;
}) {
  writeGuestSessionCookie({
    cookieStore,
    req,
    session,
    cookieName: REMOVER_ANONYMOUS_SESSION_COOKIE,
    maxAgeSeconds: REMOVER_ANONYMOUS_SESSION_MAX_AGE_SECONDS,
  });
}
