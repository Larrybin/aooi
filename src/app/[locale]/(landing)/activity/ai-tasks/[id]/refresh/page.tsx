// data: ai task (db) + upstream provider query + db update + redirect
// cache: no-store
// reason: refresh endpoint mutates state and redirects; do not cache
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { redirect } from '@/infra/platform/i18n/navigation';
import { AITaskStatus } from '@/extensions/ai';
import { Empty } from '@/shared/blocks/common/empty';
import { isAiEnabledCached } from '@/shared/lib/ai-enabled.server';
import { findAITaskById, updateAITaskById } from '@/domains/ai/infra/ai-task';
import { getAIService } from '@/domains/ai/application/service';

export default async function RefreshAITaskPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  if (!(await isAiEnabledCached())) {
    notFound();
  }

  const { locale, id } = await params;
  const t = await getTranslations('activity.ai-tasks');

  const task = await findAITaskById(id);
  if (!task || !task.taskId || !task.provider || !task.status) {
    return <Empty message={t('errors.task_not_found')} />;
  }

  // query task
  if (
    [AITaskStatus.PENDING, AITaskStatus.PROCESSING].includes(
      task.status as AITaskStatus
    )
  ) {
    const aiService = await getAIService();
    const aiProvider = aiService.getProvider(task.provider);
    if (!aiProvider) {
      return <Empty message={t('errors.invalid_ai_provider')} />;
    }

    const result = await aiProvider?.query?.({
      taskId: task.taskId,
    });

    if (result && result.taskStatus && result.taskInfo) {
      await updateAITaskById(task.id, {
        status: result.taskStatus,
        taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
        taskResult: result.taskResult
          ? JSON.stringify(result.taskResult)
          : null,
      });
    }
  }

  redirect({ href: `/activity/ai-tasks`, locale });
}
