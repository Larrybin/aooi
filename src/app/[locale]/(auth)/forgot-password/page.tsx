// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s)
// cache: dynamic (locale-aware); configs cached via unstable_cache
// reason: password recovery flow needs locale + brand settings; avoid per-request db reads
import { ForgotPassword } from '@/features/web/auth/components/forgot-password';
import { getTranslations } from 'next-intl/server';

import { defaultLocale } from '@/config/locale';
import { getServerPublicEnvConfigs } from '@/shared/lib/runtime/env.server';
import { getConfigs } from '@/shared/models/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();
  const t = await getTranslations('common');

  return {
    title: `${t('sign.forgot_password_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical:
        locale !== defaultLocale
          ? `${serverPublicEnvConfigs.app_url}/${locale}/forgot-password`
          : `${serverPublicEnvConfigs.app_url}/forgot-password`,
    },
  };
}

export default async function ForgotPasswordPage() {
  const configs = await getConfigs();
  return <ForgotPassword configs={configs} />;
}
