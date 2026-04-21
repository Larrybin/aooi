// data: locale param (for i18n-aware redirect); auth/RBAC enforced in AdminLayout
// cache: no-store (inherited from AdminLayout)
// reason: canonicalize admin entry to a concrete leaf page
import { redirect } from '@/infra/platform/i18n/navigation';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  redirect({ href: '/admin/users', locale });
}
