import 'server-only';

import { logger } from '@/shared/lib/logger.server';
import {
  getRequestContext,
  type RequestContext,
} from '@/shared/lib/request-context.server';

export type RequestLogger = {
  ctx: RequestContext;
  log: ReturnType<typeof logger.with>;
};

export function getRequestLogger(req: Request): RequestLogger {
  const ctx = getRequestContext(req);
  return { ctx, log: logger.with(ctx) };
}

