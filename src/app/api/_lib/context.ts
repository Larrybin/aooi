import 'server-only';

import type { z } from 'zod';

import {
  requirePermission,
  requireUser,
} from '@/app/access-control/api-guard';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';
import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import { parseJson, parseParams, parseQuery } from '@/shared/lib/api/parse';

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
  requireUser: () => Promise<AuthSessionUserIdentity>;
  requirePermission: (userId: string, code: string) => Promise<void>;
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
