// data: locale param (for i18n-aware redirect)
// cache: default
// reason: canonicalize `/activity` entry to a concrete leaf page
import { redirect } from '@/core/i18n/navigation';

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirect({ href: '/activity/ai-tasks', locale });
}
