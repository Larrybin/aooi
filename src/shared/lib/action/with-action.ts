import 'server-only';

import { headers } from 'next/headers';

import { BusinessError, ExternalError, PublicError } from '@/shared/lib/errors';
import { logger } from '@/shared/lib/logger.server';
import {
  generateRequestId,
  getOrCreateRequestId,
} from '@/shared/lib/request-id';

import { actionErr, type ActionResult } from './result';

async function getActionRequestId(): Promise<string> {
  try {
    return getOrCreateRequestId(await headers());
  } catch {
    return generateRequestId();
  }
}

export async function withAction<T>(
  handler: () => Promise<ActionResult & { data?: T }>
): Promise<ActionResult> {
  const requestId = await getActionRequestId();
  try {
    const result = await handler();
    if (result.requestId) return result;
    return { ...result, requestId };
  } catch (error: unknown) {
    if (error instanceof BusinessError) {
      return actionErr(error.publicMessage, requestId);
    }

    if (error instanceof ExternalError) {
      logger.error('[action] external error', { error, requestId });
      return actionErr(error.publicMessage, requestId);
    }

    if (error instanceof PublicError) {
      logger.error('[action] public error', { error, requestId });
      return actionErr(error.publicMessage, requestId);
    }

    logger.error('[action] unhandled error', { error, requestId });
    return actionErr('action failed', requestId);
  }
}
