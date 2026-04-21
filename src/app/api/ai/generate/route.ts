import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { createApiContext } from '@/app/api/_lib/context';
import { withApi } from '@/shared/lib/api/route';
import { getUuid } from '@/shared/lib/hash';
import { createAITask, updateAITaskById } from '@/shared/models/ai_task';
import { readRuntimeSettingsCached } from '@/domains/settings/application/settings-store';
import { getAIServiceWithConfigs } from '@/shared/services/ai';
import { resolveConfiguredAICapability } from '@/shared/services/ai-capabilities';

import { createAiGeneratePostAction } from './create-handler';

export const POST = withApi(
  createAiGeneratePostAction({
    requireAiEnabled,
    createApiContext,
    readRuntimeSettings: readRuntimeSettingsCached,
    getAIServiceWithConfigs,
    resolveConfiguredAICapability,
    createAITask,
    updateAITaskById,
    getUuid,
  })
);
