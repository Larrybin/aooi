import 'server-only';

import { logger } from '@/shared/lib/logger.server';

import { ActionError } from './errors';
import { actionErr, type ActionResult } from './result';

const isProduction = process.env.NODE_ENV === 'production';
const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG === 'true';

const allowedClientMessages = new Set<string>([
  'no auth',
  'no permission',
  'invalid params',
  'invalid roles',
  'invalid permissions',
  'invalid subscription no',
  'invalid subscription',
  'subscription is not active or trialing',
  'apikey not found',
  'User not found',
  'Role not found',
  'Post not found',
  'title is required',
  'name is required',
  'password is required',
  'slug and title are required',
  'access denied',
]);

function getClientMessage(error: unknown): string {
  if (error instanceof ActionError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (!isProduction || isDebugEnabled) {
      return error.message;
    }

    if (allowedClientMessages.has(error.message)) {
      return error.message;
    }
  }

  return 'action failed';
}

export async function withAction<T>(
  handler: () => Promise<ActionResult & { data?: T }>
): Promise<ActionResult> {
  try {
    return await handler();
  } catch (error: unknown) {
    if (error instanceof ActionError) {
      return actionErr(error.message);
    }

    logger.error('[action] unhandled error', { error });
    return actionErr(getClientMessage(error));
  }
}
