function getHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  return value && value.trim() ? value.trim() : null;
}

export function generateRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateRequestId(headers: Headers): string {
  return (
    getHeaderValue(headers, 'x-request-id') ||
    getHeaderValue(headers, 'x-vercel-id') ||
    getHeaderValue(headers, 'cf-ray') ||
    generateRequestId()
  );
}

export class RequestIdError extends Error {
  readonly requestId?: string;
  readonly status?: number;
  readonly url?: string;

  constructor(
    message: string,
    requestId?: string,
    options?: { status?: number; url?: string }
  ) {
    super(message);
    this.name = 'RequestIdError';
    this.requestId = requestId;
    this.status = options?.status;
    this.url = options?.url;
  }
}

export function getRequestIdFromResponse(
  response: Response
): string | undefined {
  return (
    getHeaderValue(response.headers, 'x-request-id') ||
    getHeaderValue(response.headers, 'x-vercel-id') ||
    getHeaderValue(response.headers, 'cf-ray') ||
    undefined
  );
}

export function getRequestIdFromError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const maybe = error as { requestId?: unknown };
  return typeof maybe.requestId === 'string' && maybe.requestId.trim()
    ? maybe.requestId.trim()
    : undefined;
}

export function formatMessageWithRequestId(
  message: string,
  requestId?: string
): string {
  if (!requestId) return message;
  return `${message} (requestId: ${requestId})`;
}
