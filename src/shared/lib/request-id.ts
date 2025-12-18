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

export function getRequestIdFromResponse(response: Response): string | undefined {
  const candidates = [
    response.headers.get('x-request-id'),
    response.headers.get('x-vercel-id'),
    response.headers.get('cf-ray'),
  ];

  for (const value of candidates) {
    if (value && value.trim()) return value.trim();
  }

  return undefined;
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
