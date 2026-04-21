export type MemberAiTaskRow = {
  id: string;
  userId: string;
  prompt?: string | null;
  mediaType?: string | null;
  provider?: string | null;
  model?: string | null;
  status?: string | null;
  costCredits?: number | null;
  taskInfo?: string | null;
  createdAt?: Date | null;
};

type MemberAiTasksDeps = {
  getAITasks: (input: {
    userId?: string;
    status?: string;
    mediaType?: string;
    provider?: string;
    page?: number;
    limit?: number;
    getUser?: boolean;
  }) => Promise<MemberAiTaskRow[]>;
  getAITasksCount: (input: {
    userId?: string;
    status?: string;
    mediaType?: string;
    provider?: string;
  }) => Promise<number>;
};

export async function listMemberAiTasksQuery(
  input: {
    userId: string;
    page: number;
    limit: number;
    mediaType?: string;
  },
  deps?: MemberAiTasksDeps
) {
  const resolvedDeps = deps ?? (await getMemberAiTasksDeps());
  const [rows, total] = await Promise.all([
    resolvedDeps.getAITasks({
      userId: input.userId,
      mediaType: input.mediaType,
      page: input.page,
      limit: input.limit,
    }),
    resolvedDeps.getAITasksCount({
      userId: input.userId,
      mediaType: input.mediaType,
    }),
  ]);

  return { rows, total };
}

async function getMemberAiTasksDeps(): Promise<MemberAiTasksDeps> {
  const aiTaskModule = await import('@/domains/ai/infra/ai-task');
  return {
    getAITasks: aiTaskModule.getAITasks,
    getAITasksCount: aiTaskModule.getAITasksCount,
  };
}
