import 'server-only';

import type { z } from 'zod';

import { getRequestLogger } from '@/shared/lib/request-logger.server';

import { requirePermission, requireUser } from './guard';
import { parseJson, parseParams, parseQuery } from './parse';

export type ApiContext = {
  req: Request;
  log: ReturnType<typeof getRequestLogger>['log'];
  requestId: string;
  route: string;
  method?: string;
  parseJson: <TSchema extends z.ZodTypeAny>(
    schema: TSchema
  ) => Promise<z.infer<TSchema>>;
  parseQuery: <TSchema extends z.ZodTypeAny>(
    schema: TSchema
  ) => z.infer<TSchema>;
  parseParams: <TSchema extends z.ZodTypeAny>(
    paramsPromise: Promise<unknown>,
    schema: TSchema
  ) => Promise<z.infer<TSchema>>;
  requireUser: () => ReturnType<typeof requireUser>;
  requirePermission: typeof requirePermission;
};

export function createApiContext(req: Request): ApiContext {
  const { ctx, log } = getRequestLogger(req);
  return {
    req,
    log,
    requestId: ctx.requestId,
    route: ctx.route,
    method: ctx.method,
    parseJson: (schema) => parseJson(req, schema),
    parseQuery: (schema) => parseQuery(req.url, schema),
    parseParams: (paramsPromise, schema) => parseParams(paramsPromise, schema),
    requireUser: () => requireUser(req),
    requirePermission,
  };
}
