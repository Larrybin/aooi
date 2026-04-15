const SESSION_COOKIE_NAME = 'session_token';
const SESSION_COOKIE_PREFIX = 'better-auth.';
const SECURE_COOKIE_PREFIX = '__Secure-';

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>();

  for (const rawPart of cookieHeader.split(';')) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }

    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies.set(name, decodeCookieValue(value));
  }

  return cookies;
}

export function readSessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookieHeader(cookieHeader);
  const baseName = `${SESSION_COOKIE_PREFIX}${SESSION_COOKIE_NAME}`;

  return (
    cookies.get(baseName) ?? cookies.get(`${SECURE_COOKIE_PREFIX}${baseName}`) ?? null
  );
}
