/**
 * Usage:
 * - Throw `ApiError` (or subclasses) from Route Handlers and guards.
 * - Wrap handlers with `withApi()` to convert errors into `{code,message,data}` with HTTP status.
 */

import { PublicError } from '@/shared/lib/errors';

export class ApiError extends PublicError {
  readonly status: number;

  constructor(
    status: number,
    message: string,
    data?: unknown,
    options?: { publicMessage?: string; internalMeta?: unknown }
  ) {
    super(message, {
      data,
      publicMessage: options?.publicMessage,
      internalMeta: options?.internalMeta,
    });
    this.name = 'ApiError';
    this.status = status;
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'invalid request', data?: unknown) {
    super(400, message, data);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'unauthorized', data?: unknown) {
    super(401, message, data);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'forbidden', data?: unknown) {
    super(403, message, data);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(
    message = 'not found',
    data?: unknown,
    options?: { publicMessage?: string; internalMeta?: unknown }
  ) {
    super(404, message, data, options);
    this.name = 'NotFoundError';
  }
}

export class UnprocessableEntityError extends ApiError {
  constructor(message = 'unprocessable entity', data?: unknown) {
    super(422, message, data);
    this.name = 'UnprocessableEntityError';
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'conflict', data?: unknown) {
    super(409, message, data);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = 'too many requests', data?: unknown) {
    super(429, message, data);
    this.name = 'TooManyRequestsError';
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message = 'payload too large', data?: unknown) {
    super(413, message, data);
    this.name = 'PayloadTooLargeError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(
    message = 'service unavailable',
    data?: unknown,
    options?: { publicMessage?: string; internalMeta?: unknown }
  ) {
    super(503, message, data, options);
    this.name = 'ServiceUnavailableError';
  }
}

export class UpstreamError extends ApiError {
  constructor(
    status: 502 | 503,
    message = status === 503 ? 'service unavailable' : 'bad gateway',
    data?: unknown
  ) {
    const publicMessage =
      status === 503 ? 'service unavailable' : 'bad gateway';
    super(status, message, data, { publicMessage });
    this.name = 'UpstreamError';
  }
}
