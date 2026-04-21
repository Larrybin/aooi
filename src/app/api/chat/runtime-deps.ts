import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, generateId, streamText } from 'ai';

import { requireAiEnabled } from '@/app/api/ai/_lib/guard';
import { createApiContext } from '@/app/api/_lib/context';

import {
  chatInfoDeps,
  chatListDeps,
  chatMessagesDeps,
  chatNewDeps,
  chatStreamDeps,
} from './deps';
import type { ChatHandlerDeps } from './create-handlers';

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
