// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s) + reset token/error (query)
// cache: dynamic (request-based searchParams); configs cached via unstable_cache
// reason: token-based reset flow is request-specific; avoid caching across tokens
import { ResetPassword } from '@/domains/account/ui/auth/reset-password';
import { readAuthUiRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import { buildCanonicalUrl } from '@/infra/url/canonical';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('common');

  return {
    title: `${t('sign.reset_password_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical: buildCanonicalUrl('/reset-password', locale),
    },
  };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const authSettings = await readAuthUiRuntimeSettingsCached();

  return (
    <ResetPassword token={token} error={error} authSettings={authSettings} />
  );
}
