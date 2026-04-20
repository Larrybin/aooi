import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, generateId, streamText } from 'ai';

import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { createApiContext } from '@/shared/lib/api/context';

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
