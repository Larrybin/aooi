import { signHmacSha256Hex } from '@/shared/lib/runtime/crypto';

const GUEST_SESSION_PATTERN = /^anon_[A-Za-z0-9_-]{8,80}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

export type GuestSessionOptions = {
  cookieName: string;
  secret?: string;
  createId?: () => string;
};

export type GuestSessionResult = {
  anonymousSessionId: string;
  cookieValue: string;
  shouldSetCookie: boolean;
};

type GuestSessionCookieStore = {
  set: (cookie: {
    name: string;
    value: string;
    httpOnly: true;
    sameSite: 'lax';
    secure: boolean;
    path: '/';
    maxAge: number;
  }) => void;
};

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) {
      try {
        cookies.set(name, decodeURIComponent(value));
      } catch {
        cookies.set(name, value);
      }
    }
  }

  return cookies;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function createGuestSessionId(createId?: () => string): string {
  const id = createId?.() ?? `anon_${crypto.randomUUID().replaceAll('-', '')}`;
  if (!GUEST_SESSION_PATTERN.test(id)) {
    throw new Error('invalid guest session id');
  }
  return id;
}

export async function buildGuestSessionCookie({
  anonymousSessionId,
  secret,
}: {
  anonymousSessionId: string;
  secret: string;
}): Promise<string> {
  if (!secret) {
    throw new Error('guest session secret is not configured');
  }
  if (!GUEST_SESSION_PATTERN.test(anonymousSessionId)) {
    throw new Error('invalid guest session id');
  }

  const signature = await signHmacSha256Hex(anonymousSessionId, secret);
  return `${anonymousSessionId}.${signature}`;
}

async function verifyGuestSessionCookie({
  cookieValue,
  secret,
}: {
  cookieValue: string | undefined;
  secret: string;
}): Promise<string | null> {
  const [anonymousSessionId, signature, extra] = cookieValue?.split('.') ?? [];
  if (
    extra !== undefined ||
    !anonymousSessionId ||
    !signature ||
    !GUEST_SESSION_PATTERN.test(anonymousSessionId) ||
    !SIGNATURE_PATTERN.test(signature)
  ) {
    return null;
  }

  const expected = await signHmacSha256Hex(anonymousSessionId, secret);
  return constantTimeEqual(expected, signature) ? anonymousSessionId : null;
}

export async function createGuestSession({
  secret,
  createId,
}: Pick<
  GuestSessionOptions,
  'secret' | 'createId'
>): Promise<GuestSessionResult> {
  const sessionSecret = secret?.trim() || '';
  if (!sessionSecret) {
    throw new Error('guest session secret is not configured');
  }

  const anonymousSessionId = createGuestSessionId(createId);
  return {
    anonymousSessionId,
    cookieValue: await buildGuestSessionCookie({
      anonymousSessionId,
      secret: sessionSecret,
    }),
    shouldSetCookie: true,
  };
}

export async function readGuestSession(
  req: Request,
  options: Pick<GuestSessionOptions, 'cookieName' | 'secret'>
): Promise<GuestSessionResult | null> {
  const secret = options.secret?.trim() || '';
  if (!secret) {
    return null;
  }

  const cookieValue = parseCookieHeader(req.headers.get('cookie')).get(
    options.cookieName
  );
  const anonymousSessionId = await verifyGuestSessionCookie({
    cookieValue,
    secret,
  });

  return anonymousSessionId
    ? {
        anonymousSessionId,
        cookieValue: cookieValue ?? '',
        shouldSetCookie: false,
      }
    : null;
}

export async function resolveGuestSession(
  req: Request,
  options: GuestSessionOptions
): Promise<GuestSessionResult> {
  const secret = options.secret?.trim() || '';
  if (!secret) {
    throw new Error('guest session secret is not configured');
  }

  const existingSession = await readGuestSession(req, {
    cookieName: options.cookieName,
    secret,
  });
  if (existingSession) {
    return existingSession;
  }

  return createGuestSession({
    secret,
    createId: options.createId,
  });
}

function isSecureRequest(req: Request): boolean {
  return (
    new URL(req.url).protocol === 'https:' ||
    req.headers.get('x-forwarded-proto') === 'https'
  );
}

export function writeGuestSessionCookie({
  cookieStore,
  req,
  session,
  cookieName,
  maxAgeSeconds,
}: {
  cookieStore: GuestSessionCookieStore;
  req: Request;
  session: GuestSessionResult;
  cookieName: string;
  maxAgeSeconds: number;
}) {
  if (!session.shouldSetCookie) {
    return;
  }

  cookieStore.set({
    name: cookieName,
    value: session.cookieValue,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    path: '/',
    maxAge: maxAgeSeconds,
  });
}
