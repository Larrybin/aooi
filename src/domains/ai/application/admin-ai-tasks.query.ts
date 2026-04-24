import { getAITasks, getAITasksCount } from '@/domains/ai/infra/ai-task';

export type AdminAiTaskRow = Awaited<ReturnType<typeof getAITasks>>[number];

export async function listAdminAiTasksQuery(input: {
  page: number;
  limit: number;
  mediaType?: string;
}) {
  const [rows, total] = await Promise.all([
    getAITasks({
      page: input.page,
      limit: input.limit,
      mediaType: input.mediaType,
      getUser: true,
    }),
    getAITasksCount({
      mediaType: input.mediaType,
    }),
  ]);

  return { rows, total };
}
