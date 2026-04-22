import { requireAiEnabled } from '@/app/api/ai/_lib/guard';
import { createApiContext } from '@/app/api/_lib/context';
import { withApi } from '@/shared/lib/api/route';
import { getUuid } from '@/shared/lib/hash';
import { createAITask, updateAITaskById } from '@/domains/ai/infra/ai-task';
import { readRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import { getAIServiceWithConfigs } from '@/domains/ai/application/service';
import { resolveConfiguredAICapability } from '@/domains/ai/application/capabilities';

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
