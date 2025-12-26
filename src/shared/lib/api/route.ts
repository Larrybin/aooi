/**
 * Usage:
 * - Wrap Route Handlers: `export const POST = withApi(async (req) => { ... })`
 * - Throw `ApiError` (or subclasses) for consistent `{code,message,data}` responses with HTTP status.
 */

import 'server-only';

import { BusinessError, ExternalError } from '@/shared/lib/errors';
import { logger } from '@/shared/lib/logger.server';
import { getRequestLogger } from '@/shared/lib/request-logger.server';

import { ApiError } from './errors';
import { jsonErr } from './response';

function logHandledServerError(
  reqLogger: ReturnType<typeof getRequestLogger> | undefined,
  error: Error,
  meta: Record<string, unknown>
) {
  if (reqLogger) {
    reqLogger.log.error('[api] handled server error', { ...meta, error });
    return;
  }

  logger.error('[api] handled server error', { ...meta, error });
}

function toRequestLogger(
  args: readonly unknown[]
): ReturnType<typeof getRequestLogger> | undefined {
  const maybeReq = args[0];
  return typeof maybeReq === 'object' &&
    maybeReq !== null &&
    'headers' in maybeReq &&
    'url' in maybeReq &&
    'method' in maybeReq
    ? getRequestLogger(maybeReq as Request)
    : undefined;
}

function attachRequestIdHeader(
  response: Response,
  requestId: string
): Response {
  try {
    response.headers.set('x-request-id', requestId);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set('x-request-id', requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

type ApiRouteHandlerArgs =
  | readonly []
  | readonly [request: Request, ...rest: readonly unknown[]];

export function withApi<Args extends ApiRouteHandlerArgs, R>(
  handler: (...args: Args) => R
): (...args: Args) => Promise<Awaited<R>> {
  return (async (...args: Args) => {
    const reqLogger = toRequestLogger(args);
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
        logger.error('[api] unhandled error', { error });
      }
      const response = jsonErr(500, 'internal server error');
      return reqLogger
        ? attachRequestIdHeader(response, reqLogger.ctx.requestId)
        : response;
    }
  }) as (...args: Args) => Promise<Awaited<R>>;
}
