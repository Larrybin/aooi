import { requireAiEnabled } from '@/app/api/ai/_lib/guard';
import { createApiContext } from '@/app/api/_lib/context';
import { withApi } from '@/shared/lib/api/route';
import { getUuid } from '@/shared/lib/hash';
import { createAITask, updateAITaskById } from '@/domains/ai/infra/ai-task';
import { readAiRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import { getAIService } from '@/domains/ai/application/service';
import { resolveConfiguredAICapability } from '@/domains/ai/application/capabilities';
import { getAiProviderBindings } from '@/domains/ai/application/provider-bindings';

import { createAiGeneratePostAction } from './create-handler';

export const POST = withApi(
  createAiGeneratePostAction({
    requireAiEnabled,
    createApiContext,
    readAiRuntimeSettings: readAiRuntimeSettingsCached,
    readAiProviderBindings: getAiProviderBindings,
    getAIService,
    resolveConfiguredAICapability,
    createAITask,
    updateAITaskById,
    getUuid,
  })
);
