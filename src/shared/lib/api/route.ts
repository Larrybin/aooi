/**
 * Usage:
 * - Wrap Route Handlers: `export const POST = withApi(async (req) => { ... })`
 * - Throw `ApiError` (or subclasses) for consistent `{code,message,data}` responses with HTTP status.
 */

import { BusinessError, ExternalError } from '@/shared/lib/errors';

import { ApiError } from './errors';
import { jsonErr } from './response';
import { setResponseHeader } from './response-headers';

type LogLike = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

type RequestLoggerLike = {
  ctx: { requestId: string };
  log: LogLike;
};

const fallbackLog: LogLike = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function createFallbackRequestLogger(request: Request): RequestLoggerLike {
  return {
    ctx: {
      requestId: request.headers.get('x-request-id') || crypto.randomUUID(),
    },
    log: fallbackLog,
  };
}

function logHandledServerError(
  reqLogger: RequestLoggerLike | undefined,
  error: Error,
  meta: Record<string, unknown>
) {
  if (reqLogger) {
    reqLogger.log.error('[api] handled server error', { ...meta, error });
    return;
  }

  fallbackLog.error('[api] handled server error', { ...meta, error });
}

async function toRequestLogger(
  args: readonly unknown[]
): Promise<RequestLoggerLike | undefined> {
  const maybeReq = args[0];
  if (
    !(
      typeof maybeReq === 'object' &&
      maybeReq !== null &&
      'headers' in maybeReq &&
      'url' in maybeReq &&
      'method' in maybeReq
    )
  ) {
    return undefined;
  }

  const request = maybeReq as Request;
  try {
    const mod = await import('@/shared/lib/request-logger.server');
    return mod.getRequestLogger(request);
  } catch {
    return createFallbackRequestLogger(request);
  }
}

function attachRequestIdHeader(
  response: Response,
  requestId: string
): Response {
  return setResponseHeader(response, 'x-request-id', requestId);
}

type ApiRouteHandlerArgs =
  | readonly []
  | readonly [request: Request, ...rest: readonly unknown[]];

export function withApi<Args extends ApiRouteHandlerArgs, R>(
  handler: (...args: Args) => R
): (...args: Args) => Promise<Awaited<R>> {
  return (async (...args: Args) => {
    const reqLogger = await toRequestLogger(args);
    try {
      const result = await handler(...args);
      if (reqLogger && result instanceof Response) {
        return attachRequestIdHeader(result, reqLogger.ctx.requestId);
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status >= 500) {
          logHandledServerError(reqLogger, error, {
            status: error.status,
            kind: 'ApiError',
          });
        }
        const response = jsonErr(error.status, error.publicMessage, error.data);
        return reqLogger
          ? attachRequestIdHeader(response, reqLogger.ctx.requestId)
          : response;
      }

      if (error instanceof BusinessError) {
        const response = jsonErr(400, error.publicMessage, error.data);
        return reqLogger
          ? attachRequestIdHeader(response, reqLogger.ctx.requestId)
          : response;
      }

      if (error instanceof ExternalError) {
        if (error.status >= 500) {
          logHandledServerError(reqLogger, error, {
            status: error.status,
            kind: 'ExternalError',
          });
        }
        const response = jsonErr(error.status, error.publicMessage, error.data);
        return reqLogger
          ? attachRequestIdHeader(response, reqLogger.ctx.requestId)
          : response;
      }

      if (reqLogger) {
        reqLogger.log.error('[api] unhandled error', { error });
      } else {
        fallbackLog.error('[api] unhandled error', { error });
      }
      const response = jsonErr(500, 'internal server error');
      return reqLogger
        ? attachRequestIdHeader(response, reqLogger.ctx.requestId)
        : response;
    }
  }) as (...args: Args) => Promise<Awaited<R>>;
}
