export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function toErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function toError(
  error: unknown,
  fallbackMessage = 'Unknown error'
): Error {
  if (error instanceof Error) return error;
  const message = toErrorMessage(error);
  return new Error(message || fallbackMessage);
}

export type PublicErrorOptions = {
  publicMessage?: string;
  data?: unknown;
  cause?: unknown;
};

export class PublicError extends Error {
  readonly publicMessage: string;
  readonly data?: unknown;

  constructor(message: string, options?: PublicErrorOptions) {
    super(message);
    this.name = 'PublicError';
    this.publicMessage = options?.publicMessage ?? message;
    this.data = options?.data;

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export class BusinessError extends PublicError {
  constructor(message: string, options?: PublicErrorOptions) {
    super(message, options);
    this.name = 'BusinessError';
  }
}

function defaultExternalPublicMessage(status: number): string {
  switch (status) {
    case 502:
      return 'bad gateway';
    case 503:
      return 'service unavailable';
    default:
      return 'external error';
  }
}

export class ExternalError extends PublicError {
  readonly status: number;

  constructor(status: number, message: string, options?: PublicErrorOptions) {
    super(message, {
      ...options,
      publicMessage:
        options?.publicMessage ?? defaultExternalPublicMessage(status),
    });
    this.name = 'ExternalError';
    this.status = status;
  }
}
