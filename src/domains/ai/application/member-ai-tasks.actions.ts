import { AITaskStatus, type AIProvider } from '@/extensions/ai';
import type {
  AITask,
  UpdateAITask,
  findAITaskById,
  updateAITaskById,
} from '@/domains/ai/infra/ai-task';

type RefreshMemberAiTaskDeps = {
  findAITaskById: typeof findAITaskById;
  updateAITaskById: typeof updateAITaskById;
  getProvider: (name: string) => Promise<AIProvider | undefined>;
};

export async function refreshMemberAiTaskUseCase(
  input: {
    taskId: string;
    actorUserId: string;
  },
  deps?: RefreshMemberAiTaskDeps
): Promise<
  | { status: 'hidden' }
  | { status: 'invalid_provider' }
  | { status: 'ok' }
> {
  const resolvedDeps = deps ?? (await getRefreshMemberAiTaskDeps());
  const task = await resolvedDeps.findAITaskById(input.taskId);
  if (!hasRefreshableTaskTarget(task)) {
    return { status: 'hidden' };
  }

  if (task.userId !== input.actorUserId) {
    return { status: 'hidden' };
  }

  if (
    ![AITaskStatus.PENDING, AITaskStatus.PROCESSING].includes(
      task.status as AITaskStatus
    )
  ) {
    return { status: 'ok' };
  }

  const aiProvider = await resolvedDeps.getProvider(task.provider);
  if (!aiProvider) {
    return { status: 'invalid_provider' };
  }

  const result = await aiProvider.query?.({
    taskId: task.taskId,
  });

  if (result && result.taskStatus && result.taskInfo) {
    const update: UpdateAITask = {
      status: result.taskStatus,
      taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
      taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
      creditId: task.creditId ?? undefined,
    };
    await resolvedDeps.updateAITaskById(task.id, update);
  }

  return { status: 'ok' };
}

function hasRefreshableTaskTarget(task: AITask | undefined): task is AITask & {
  taskId: string;
  provider: string;
  status: string;
} {
  return Boolean(task?.taskId && task?.provider && task?.status);
}

async function getRefreshMemberAiTaskDeps(): Promise<RefreshMemberAiTaskDeps> {
  const [aiTaskModule, serviceModule] = await Promise.all([
    import('@/domains/ai/infra/ai-task'),
    import('@/domains/ai/application/service'),
  ]);

  return {
    findAITaskById: aiTaskModule.findAITaskById,
    updateAITaskById: aiTaskModule.updateAITaskById,
    getProvider: async (name) => {
      const aiService = await serviceModule.getAIService();
      return aiService.getProvider(name);
    },
  };
}
