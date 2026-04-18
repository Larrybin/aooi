import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { createApiContext } from '@/shared/lib/api/context';
import { withApi } from '@/shared/lib/api/route';
import { getUuid } from '@/shared/lib/hash';
import { createAITask, updateAITaskById } from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
import { getAIServiceWithConfigs } from '@/shared/services/ai';
import { resolveConfiguredAICapability } from '@/shared/services/ai-capabilities';

import { createAiGeneratePostAction } from './create-handler';

export const POST = withApi(
  createAiGeneratePostAction({
    requireAiEnabled,
    createApiContext,
    getAllConfigs,
    getAIServiceWithConfigs,
    resolveConfiguredAICapability,
    createAITask,
    updateAITaskById,
    getUuid,
  })
);
