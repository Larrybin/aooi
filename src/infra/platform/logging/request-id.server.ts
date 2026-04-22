type HeaderLike = Pick<Headers, 'get'>;

const MAX_REQUEST_ID_LENGTH = 200;
const SAFE_REQUEST_ID_PATTERN = /^[\x21-\x7E]+$/;

function getHeaderValue(headers: HeaderLike, name: string): string | null {
  const value = headers.get(name);
  return value && value.trim() ? value.trim() : null;
}

function sanitizeInboundRequestId(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!SAFE_REQUEST_ID_PATTERN.test(trimmed)) return null;

  return trimmed;
}

export function generateRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateRequestId(headers: HeaderLike): string {
  return (
    sanitizeInboundRequestId(getHeaderValue(headers, 'x-request-id')) ||
    getHeaderValue(headers, 'x-vercel-id') ||
    getHeaderValue(headers, 'cf-ray') ||
    generateRequestId()
  );
}
