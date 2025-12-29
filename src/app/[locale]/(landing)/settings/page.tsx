// data: locale param (for i18n-aware redirect)
// cache: default
// reason: canonicalize `/settings` entry to a concrete leaf page
import { redirect } from '@/core/i18n/navigation';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirect({ href: '/settings/profile', locale });
}
