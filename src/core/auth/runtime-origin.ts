function normalizeAuthOrigin(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('must use http or https');
    }
    return url.origin;
  } catch (error) {
    throw new Error(`Invalid ${label} origin: ${value} (${String(error)})`);
  }
}

function tryNormalizeAuthOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return normalizeAuthOrigin(trimmed, 'request origin');
  } catch {
    return null;
  }
}

function addOriginCandidate(candidates: string[], value: string | null) {
  if (value && !candidates.includes(value)) {
    candidates.push(value);
  }
}

function isCanonicalHttpPreviewVariant(origin: string, canonicalOrigin: string) {
  try {
    const runtimeUrl = new URL(origin);
    const canonicalUrl = new URL(canonicalOrigin);

    return (
      runtimeUrl.protocol === 'http:' &&
      canonicalUrl.protocol === 'https:' &&
      !isLocalAuthHost(canonicalUrl.host) &&
      runtimeUrl.host === canonicalUrl.host
    );
  } catch {
    return false;
  }
}

function normalizeAllowedRuntimeOrigin(origin: string, canonicalOrigin: string) {
  if (isCanonicalHttpPreviewVariant(origin, canonicalOrigin)) {
    return canonicalOrigin;
  }

  return origin;
}

function readRequestHostOrigin(request: Request): string | null {
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host?.trim()) {
    return null;
  }

  const protocol =
    request.headers.get('x-forwarded-proto') ||
    (isLocalAuthHost(host) ? 'http' : tryReadUrlProtocol(request.url)) ||
    'http';

  return tryNormalizeAuthOrigin(`${protocol}://${host}`);
}

function isLocalAuthHost(host: string): boolean {
  const hostname = host.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function tryReadUrlProtocol(value: string): string | null {
  try {
    const protocol = new URL(value).protocol.replace(/:$/, '');
    return protocol === 'http' || protocol === 'https' ? protocol : null;
  } catch {
    return null;
  }
}

export function isLocalAuthRuntimeOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

function assertAllowedRuntimeOrigin(origin: string, canonicalOrigin: string) {
  if (origin === canonicalOrigin || isLocalAuthRuntimeOrigin(origin)) {
    return;
  }

  throw new Error(
    `Unexpected runtime auth origin: ${origin}. Expected ${canonicalOrigin} or localhost/127.0.0.1 preview origin.`
  );
}

function readRequestOriginCandidates(request?: Request): string[] {
  if (!request) {
    return [];
  }

  const candidates: string[] = [];
  addOriginCandidate(
    candidates,
    tryNormalizeAuthOrigin(request.headers.get('origin'))
  );
  addOriginCandidate(candidates, readRequestHostOrigin(request));
  addOriginCandidate(candidates, tryNormalizeAuthOrigin(request.url));

  return candidates;
}

export function readRequestOrigin(request?: Request): string | null {
  return readRequestOriginCandidates(request)[0] || null;
}

export function buildTrustedAuthOrigins(params: {
  appUrl: string;
  request?: Request;
  allowLocalMockOrigins?: boolean;
}): string[] {
  const canonicalOrigin = normalizeAuthOrigin(
    params.appUrl,
    'NEXT_PUBLIC_APP_URL'
  );
  const origins = new Set<string>([canonicalOrigin]);

  if (params.allowLocalMockOrigins) {
    origins.add('http://127.0.0.1:8787');
    origins.add('http://localhost:8787');
  }

  for (const requestOrigin of readRequestOriginCandidates(params.request)) {
    const normalizedRequestOrigin = normalizeAllowedRuntimeOrigin(
      requestOrigin,
      canonicalOrigin
    );
    assertAllowedRuntimeOrigin(normalizedRequestOrigin, canonicalOrigin);
    origins.add(normalizedRequestOrigin);
  }

  origins.add('https://accounts.google.com');
  return [...origins];
}

export function resolveRuntimeAuthBaseUrl(params: {
  defaultBaseUrl: string;
  preferRequestOrigin?: boolean;
  request?: Request;
}): string {
  const canonicalOrigin = normalizeAuthOrigin(
    params.defaultBaseUrl,
    'default auth base URL'
  );

  for (const requestOrigin of readRequestOriginCandidates(params.request)) {
    const normalizedRequestOrigin = normalizeAllowedRuntimeOrigin(
      requestOrigin,
      canonicalOrigin
    );
    assertAllowedRuntimeOrigin(normalizedRequestOrigin, canonicalOrigin);
    if (
      params.preferRequestOrigin ||
      isLocalAuthRuntimeOrigin(normalizedRequestOrigin)
    ) {
      return normalizedRequestOrigin;
    }
  }

  return canonicalOrigin;
}
