import { AITaskStatus } from '@/extensions/ai';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/lib/api/errors';
import { requireUser } from '@/shared/lib/api/guard';
import { parseJson } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse } from '@/shared/lib/json';
import {
  findAITaskById,
  UpdateAITask,
  updateAITaskById,
} from '@/shared/models/ai_task';
import { AiQueryBodySchema } from '@/shared/schemas/api/ai/query';
import { getAIService } from '@/shared/services/ai';

const MIN_PROVIDER_QUERY_INTERVAL_MS = 4000;
const lastProviderQueryAtByTaskId = new Map<string, number>();

function isFinalTaskStatus(status: string | null | undefined) {
  return (
    status === AITaskStatus.SUCCESS ||
    status === AITaskStatus.FAILED ||
    status === AITaskStatus.CANCELED
  );
}

function shouldQueryProvider(taskId: string) {
  const now = Date.now();
  const last = lastProviderQueryAtByTaskId.get(taskId);
  if (last && now - last < MIN_PROVIDER_QUERY_INTERVAL_MS) {
    return false;
  }
  lastProviderQueryAtByTaskId.set(taskId, now);
  return true;
}

export const POST = withApi(async (req: Request) => {
  const { taskId } = await parseJson(req, AiQueryBodySchema);
  if (!taskId) {
    throw new BadRequestError('invalid params');
  }

  const user = await requireUser(req);

  const task = await findAITaskById(taskId);
  if (!task || !task.taskId) {
    throw new NotFoundError('task not found');
  }

  if (task.userId !== user.id) {
    throw new ForbiddenError('no permission');
  }

  if (isFinalTaskStatus(task.status)) {
    return jsonOk({
      id: task.id,
      status: task.status,
      provider: task.provider,
      model: task.model,
      prompt: task.prompt,
      taskInfo: safeJsonParse(task.taskInfo),
    });
  }

  if (!shouldQueryProvider(task.id)) {
    return jsonOk({
      id: task.id,
      status: task.status,
      provider: task.provider,
      model: task.model,
      prompt: task.prompt,
      taskInfo: safeJsonParse(task.taskInfo),
    });
  }

  const aiService = await getAIService();
  const aiProvider = aiService.getProvider(task.provider);
  if (!aiProvider) {
    throw new BadRequestError('invalid ai provider');
  }

  const result = await aiProvider?.query?.({
    taskId: task.taskId,
  });

  if (!result?.taskStatus) {
    throw new Error('query ai task failed');
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

  return jsonOk({
    id: task.id,
    status: task.status,
    provider: task.provider,
    model: task.model,
    prompt: task.prompt,
    taskInfo: safeJsonParse(task.taskInfo),
  });
});
