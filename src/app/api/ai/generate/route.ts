import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { createApiContext } from '@/shared/lib/api/context';
import { getUuid } from '@/shared/lib/hash';
import {
  createAITask,
  updateAITaskById,
} from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
import { resolveConfiguredAICapability } from '@/shared/services/ai-capabilities';
import { getAIManagerWithConfigs } from '@/shared/services/ai';

import { createAiGeneratePostHandler } from './create-handler';

export const POST = createAiGeneratePostHandler({
  requireAiEnabled,
  createApiContext,
  getAllConfigs,
  getAIManagerWithConfigs,
  resolveConfiguredAICapability,
  createAITask,
  updateAITaskById,
  getUuid,
});
