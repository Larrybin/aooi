import { AITaskStatus } from '@/extensions/ai';
import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse } from '@/shared/lib/json';
import { cleanupExpiringMap } from '@/shared/lib/map-cleanup';
import {
  findAITaskById,
  updateAITaskById,
  type UpdateAITask,
} from '@/shared/models/ai_task';
import { AiQueryBodySchema } from '@/shared/schemas/api/ai/query';
import { getAIService } from '@/shared/services/ai';

const MIN_PROVIDER_QUERY_INTERVAL_MS = 4000;
const lastProviderQueryAtByTaskId = new Map<string, number>();
const PROVIDER_QUERY_THROTTLE_TTL_MS = 60 * 60 * 1000; // 1 hour
const PROVIDER_QUERY_THROTTLE_MAX_ENTRIES = 10_000;
let providerQueryThrottleCleanupTick = 0;

function cleanupProviderQueryThrottle(now: number): void {
  cleanupExpiringMap({
    map: lastProviderQueryAtByTaskId,
    now,
    ttlMs: PROVIDER_QUERY_THROTTLE_TTL_MS,
    maxEntries: PROVIDER_QUERY_THROTTLE_MAX_ENTRIES,
    getTimestamp: (lastAt) => lastAt,
  });
}

function isFinalTaskStatus(status: string | null | undefined) {
  return (
    status === AITaskStatus.SUCCESS ||
    status === AITaskStatus.FAILED ||
    status === AITaskStatus.CANCELED
  );
}

function shouldQueryProvider(taskId: string) {
  const now = Date.now();
  if ((providerQueryThrottleCleanupTick++ & 0xff) === 0) {
    cleanupProviderQueryThrottle(now);
  }

  const last = lastProviderQueryAtByTaskId.get(taskId);
  if (last && now - last < MIN_PROVIDER_QUERY_INTERVAL_MS) {
    return false;
  }
  lastProviderQueryAtByTaskId.set(taskId, now);

  if (lastProviderQueryAtByTaskId.size > PROVIDER_QUERY_THROTTLE_MAX_ENTRIES) {
    cleanupProviderQueryThrottle(now);
  }

  return true;
}

function toTaskResponse(task: {
  id: string;
  status: string | null;
  provider: string;
  model: string | null;
  prompt: string | null;
  taskInfo: string | null;
}) {
  return {
    id: task.id,
    status: task.status,
    provider: task.provider,
    model: task.model,
    prompt: task.prompt,
    taskInfo: safeJsonParse(task.taskInfo),
  };
}

export const POST = withApi(async (req: Request) => {
  await requireAiEnabled();

  const api = createApiContext(req);
  const { log } = api;
  const { taskId } = await api.parseJson(AiQueryBodySchema);
  if (!taskId) {
    throw new BadRequestError('invalid params');
  }

  const user = await api.requireUser();

  const task = await findAITaskById(taskId);
  if (!task || !task.taskId) {
    throw new NotFoundError('task not found');
  }

  if (task.userId !== user.id) {
    throw new ForbiddenError('no permission');
  }

  if (isFinalTaskStatus(task.status)) {
    lastProviderQueryAtByTaskId.delete(task.id);
    return jsonOk(toTaskResponse(task), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!shouldQueryProvider(task.id)) {
    return jsonOk(toTaskResponse(task), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const aiService = await getAIService();
  const aiProvider = aiService.getProvider(task.provider);
  if (!aiProvider) {
    throw new BadRequestError('invalid ai provider');
  }

  if (typeof aiProvider.query !== 'function') {
    log.error('ai: provider does not support query', {
      provider: task.provider,
      dbTaskId: task.id,
      providerTaskId: task.taskId,
    });
    throw new ServiceUnavailableError('ai provider does not support query');
  }

  const result = await aiProvider.query({
    taskId: task.taskId,
  });

  if (!result?.taskStatus) {
    log.error('ai: provider query returned invalid payload', {
      provider: task.provider,
      dbTaskId: task.id,
      providerTaskId: task.taskId,
    });
    throw new UpstreamError(502, 'ai task query failed');
  }

  const nextTaskInfo = result.taskInfo ? JSON.stringify(result.taskInfo) : null;
  const nextTaskResult = result.taskResult
    ? JSON.stringify(result.taskResult)
    : null;

  const updateAITask: UpdateAITask = {
    status: result.taskStatus,
    taskInfo: nextTaskInfo,
    taskResult: nextTaskResult,
    creditId: task.creditId, // credit consumption record id
  };

  const shouldUpdate =
    updateAITask.status !== task.status ||
    updateAITask.taskInfo !== task.taskInfo ||
    updateAITask.taskResult !== task.taskResult;

  if (shouldUpdate) {
    await updateAITaskById(task.id, updateAITask);
  }

  task.status = updateAITask.status || '';
  task.taskInfo = updateAITask.taskInfo ?? null;
  task.taskResult = updateAITask.taskResult ?? null;

  return jsonOk(toTaskResponse(task), {
    headers: { 'Cache-Control': 'no-store' },
  });
});
