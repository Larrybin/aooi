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
import {
  createAITask,
  updateAITaskById,
  type NewAITask,
} from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
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

  const appUrl = resolveAppUrlOrigin(configs.app_url || envConfigs.app_url);
  const callbackUrl = `${appUrl}/api/ai/notify/${provider}`;
  const params: AIGenerateParams = {
    mediaType,
    model,
    prompt,
    callbackUrl,
    options,
  };

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
    taskId: null,
    taskInfo: null,
    taskResult: null,
  };

  let task: Awaited<ReturnType<typeof createAITask>>;
  try {
    task = await createAITask(newAITask);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.startsWith('Insufficient credits')
    ) {
      throw new ForbiddenError('insufficient credits');
    }
    throw error;
  }

  let result: Awaited<ReturnType<typeof aiProvider.generate>>;
  try {
    result = await aiProvider.generate({ params });
  } catch (error: unknown) {
    log.error('ai: generate threw', {
      provider,
      mediaType,
      model,
      dbTaskId: task.id,
      error,
    });
    await updateAITaskById(task.id, {
      status: AITaskStatus.FAILED,
      taskInfo: JSON.stringify({ errorMessage: 'ai generate failed' }),
      creditId: task.creditId,
    });
    throw new UpstreamError(502, 'ai generate failed');
  }

  if (!result?.taskId) {
    log.error('ai: generate returned invalid payload', {
      provider,
      mediaType,
      model,
      dbTaskId: task.id,
      hasTaskId: Boolean(result?.taskId),
    });
    await updateAITaskById(task.id, {
      status: AITaskStatus.FAILED,
      taskInfo: JSON.stringify({ errorMessage: 'ai generate failed' }),
      creditId: task.creditId,
    });
    throw new UpstreamError(502, 'ai generate failed');
  }

  const nextTaskInfo = result.taskInfo ? JSON.stringify(result.taskInfo) : null;
  const nextTaskResult = result.taskResult
    ? JSON.stringify(result.taskResult)
    : null;

  const updated = await updateAITaskById(task.id, {
    taskId: result.taskId,
    taskInfo: nextTaskInfo,
    taskResult: nextTaskResult,
  });

  return jsonOk(updated, { headers: { 'Cache-Control': 'no-store' } });
});
