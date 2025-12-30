// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s)
// cache: dynamic (locale-aware); configs cached via unstable_cache
// reason: password recovery flow needs locale + brand settings; avoid per-request db reads
import { getTranslations } from 'next-intl/server';

import { envConfigs } from '@/config';
import { defaultLocale } from '@/config/locale';
import { ForgotPassword } from '@/shared/blocks/sign/forgot-password';
import { getConfigs } from '@/shared/models/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('common');

  return {
    title: `${t('sign.forgot_password_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical:
        locale !== defaultLocale
          ? `${envConfigs.app_url}/${locale}/forgot-password`
          : `${envConfigs.app_url}/forgot-password`,
    },
  };
}

export default async function ForgotPasswordPage() {
  const configs = await getConfigs();
  return <ForgotPassword configs={configs} />;
}
