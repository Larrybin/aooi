// data: ai task (db) + upstream provider query + db update + redirect
// cache: no-store
// reason: refresh endpoint mutates state and redirects; do not cache
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { redirect } from '@/infra/platform/i18n/navigation';
import { Empty } from '@/shared/blocks/common/empty';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { refreshMemberAiTaskUseCase } from '@/domains/ai/application/member-ai-tasks.actions';

export default async function RefreshAITaskPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  if (!isAiEnabled(await getPublicConfigsCached())) {
    notFound();
  }

  const { locale, id } = await params;
  const t = await getTranslations('activity.ai-tasks');
  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={t('errors.task_not_found')} />;
  }

  const result = await refreshMemberAiTaskUseCase({
    taskId: id,
    actorUserId: user.id,
  });
  if (result.status === 'hidden') {
    return <Empty message={t('errors.task_not_found')} />;
  }
  if (
    result.status === 'invalid_provider' ||
    result.status === 'query_failed'
  ) {
    return <Empty message={t('errors.invalid_ai_provider')} />;
  }

  redirect({ href: `/activity/ai-tasks`, locale });
}
