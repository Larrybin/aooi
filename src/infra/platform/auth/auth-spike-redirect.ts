import { readRequestOrigin } from './runtime-origin';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function repairDuplicatedLocalPortLocation(
  location: string,
  requestUrl: URL
): string {
  if (!requestUrl.port) {
    return location;
  }

  const malformedOriginPattern = new RegExp(
    `^${escapeRegExp(requestUrl.origin)}(?::${escapeRegExp(requestUrl.port)})+`
  );
  const malformedOriginMatch = location.match(malformedOriginPattern);
  if (!malformedOriginMatch) {
    return location;
  }

  return `${requestUrl.origin}${location.slice(malformedOriginMatch[0].length)}`;
}

export function resolveAuthSpikeRedirectRequestUrl(
  request: Pick<Request, 'headers' | 'url'>,
  options: {
    runtimeBaseUrl?: string | null;
  } = {}
): string {
  const requestOrigin = readRequestOrigin(request as Request);
  const runtimeBaseUrl = options.runtimeBaseUrl?.trim() || '';
  const resolvedRequestOrigin = resolveRedirectRequestOrigin({
    requestOrigin,
    runtimeBaseUrl,
  });

  if (!resolvedRequestOrigin) {
    return request.url;
  }

  try {
    const resolvedRequestUrl = new URL(request.url);
    const resolvedOriginUrl = new URL(resolvedRequestOrigin);
    resolvedRequestUrl.protocol = resolvedOriginUrl.protocol;
    resolvedRequestUrl.host = resolvedOriginUrl.host;
    return resolvedRequestUrl.toString();
  } catch {
    return request.url;
  }
}

function isLocalPreviewOrigin(value: string, requirePort: boolean): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      (requirePort ? !!url.port : !url.port)
    );
  } catch {
    return false;
  }
}

function resolveRedirectRequestOrigin(params: {
  requestOrigin: string | null;
  runtimeBaseUrl: string;
}): string | null {
  const { requestOrigin, runtimeBaseUrl } = params;
  const runtimeBaseOrigin = runtimeBaseUrl
    ? (() => {
        try {
          return new URL(runtimeBaseUrl).origin;
        } catch {
          return '';
        }
      })()
    : '';

  if (!requestOrigin) {
    return isLocalPreviewOrigin(runtimeBaseOrigin, true)
      ? runtimeBaseOrigin
      : null;
  }

  if (
    isLocalPreviewOrigin(requestOrigin, false) &&
    isLocalPreviewOrigin(runtimeBaseOrigin, true)
  ) {
    const requestUrl = new URL(requestOrigin);
    const runtimeUrl = new URL(runtimeBaseOrigin);

    if (requestUrl.hostname === runtimeUrl.hostname) {
      return runtimeBaseOrigin;
    }
  }

  return requestOrigin;
}

export function normalizeAuthSpikeRedirectLocationValue(
  location: string,
  requestUrl: string
): string | null {
  const requestOrigin = new URL(requestUrl).origin;
  const requestOriginUrl = new URL(requestOrigin);
  const normalizedLocation = repairDuplicatedLocalPortLocation(
    location.trim(),
    new URL(requestUrl)
  );

  try {
    const locationUrl = new URL(normalizedLocation, requestUrl);
    if (locationUrl.origin === requestOrigin) {
      return locationUrl.toString();
    }

    locationUrl.protocol = requestOriginUrl.protocol;
    locationUrl.host = requestOriginUrl.host;
    return locationUrl.toString();
  } catch {
    return null;
  }
}

export function toRelativeSameOriginAuthSpikeRedirectLocationValue(
  location: string,
  requestUrl: string
): string | null {
  try {
    const locationUrl = new URL(location, requestUrl);
    const requestOrigin = new URL(requestUrl).origin;
    if (locationUrl.origin !== requestOrigin) {
      return null;
    }

    return `${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;
  } catch {
    return null;
  }
}
