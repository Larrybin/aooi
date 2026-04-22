// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s) + reset token/error (query)
// cache: dynamic (request-based searchParams); configs cached via unstable_cache
// reason: token-based reset flow is request-specific; avoid caching across tokens
import { ResetPassword } from '@/domains/account/ui/auth/reset-password';
import { getTranslations } from 'next-intl/server';

import { defaultLocale } from '@/config/locale';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';
import { readSettingsCached } from '@/domains/settings/application/settings-store';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();
  const t = await getTranslations('common');

  return {
    title: `${t('sign.reset_password_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical:
        locale !== defaultLocale
          ? `${serverPublicEnvConfigs.app_url}/${locale}/reset-password`
          : `${serverPublicEnvConfigs.app_url}/reset-password`,
    },
  };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const configs = await readSettingsCached();

  return <ResetPassword token={token} error={error} configs={configs} />;
}
