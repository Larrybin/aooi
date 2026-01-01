import { envConfigs } from '@/config';
import {
  AIMediaType,
  AITaskStatus,
  type AIGenerateParams,
} from '@/extensions/ai';
import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  ForbiddenError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getUuid } from '@/shared/lib/hash';
import { createAITask, type NewAITask } from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
import { getRemainingCredits } from '@/shared/models/credit';
import { AiGenerateBodySchema } from '@/shared/schemas/api/ai/generate';
import { getAIManagerWithConfigs } from '@/shared/services/ai';

function resolveAppUrlOrigin(appUrl: string): string {
  const raw = appUrl?.trim() || '';
  if (!raw) return envConfigs.app_url;

  try {
    return new URL(raw).origin;
  } catch {
    return envConfigs.app_url;
  }
}

export const POST = withApi(async (request: Request) => {
  await requireAiEnabled();

  const api = createApiContext(request);
  const { log } = api;
  const { provider, mediaType, model, prompt, options, scene } =
    await api.parseJson(AiGenerateBodySchema);

  const configs = await getAllConfigs();
  const aiService = getAIManagerWithConfigs(configs);

  const aiProvider = aiService.getProvider(provider);
  if (!aiProvider) {
    throw new BadRequestError('invalid provider');
  }

  const user = await api.requireUser();

  let costCredits = 2;
  let finalScene = scene;

  if (mediaType === AIMediaType.IMAGE) {
    if (finalScene === 'image-to-image') {
      costCredits = 4;
    } else if (finalScene === 'text-to-image') {
      costCredits = 2;
    } else {
      throw new BadRequestError('invalid scene');
    }
  } else if (mediaType === AIMediaType.MUSIC) {
    costCredits = 10;
    finalScene = 'text-to-music';
  } else {
    throw new BadRequestError('invalid mediaType');
  }

  const remainingCredits = await getRemainingCredits(user.id);
  if (remainingCredits < costCredits) {
    throw new ForbiddenError('insufficient credits');
  }

  const appUrl = resolveAppUrlOrigin(configs.app_url || envConfigs.app_url);
  const callbackUrl = `${appUrl}/api/ai/notify/${provider}`;
  const params: AIGenerateParams = {
    mediaType,
    model,
    prompt,
    callbackUrl,
    options,
  };

  const result = await aiProvider.generate({ params });
  if (!result?.taskId) {
    log.error('ai: generate failed', {
      provider,
      mediaType,
      model,
      hasTaskId: Boolean(result?.taskId),
    });
    throw new UpstreamError(502, 'ai generate failed');
  }

  const newAITask: NewAITask = {
    id: getUuid(),
    userId: user.id,
    mediaType,
    provider,
    model,
    prompt,
    scene: finalScene,
    options: options ? JSON.stringify(options) : null,
    status: AITaskStatus.PENDING,
    costCredits,
    taskId: result.taskId,
    taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
    taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
  };

  await createAITask(newAITask);
  return jsonOk(newAITask, { headers: { 'Cache-Control': 'no-store' } });
});
