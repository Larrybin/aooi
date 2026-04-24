import { createApiContext } from '@/app/api/_lib/context';
import { requireAiEnabled } from '@/app/api/ai/_lib/guard';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, generateId, streamText } from 'ai';

import type { ChatHandlerDeps } from './create-handlers';
import {
  chatInfoDeps,
  chatListDeps,
  chatMessagesDeps,
  chatNewDeps,
  chatStreamDeps,
} from './deps';

export const chatHandlerRuntimeDeps: ChatHandlerDeps = {
  requireAiEnabled,
  createApiContext,
  generateId,
  now: () => new Date(),
  createProvider: createOpenRouter,
  streamText,
  convertToModelMessages,
  chatNewDeps,
  chatListDeps,
  chatInfoDeps,
  chatMessagesDeps,
  chatStreamDeps,
};
