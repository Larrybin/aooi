// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s) + callbackUrl (query)
// cache: dynamic (request-based searchParams); configs cached via unstable_cache
// reason: public auth entry; support callback redirects without cross-request caching
import { SignUp } from '@/features/web/auth/components/sign-up';
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
    title: `${t('sign.sign_up_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical:
        locale !== defaultLocale
          ? `${serverPublicEnvConfigs.app_url}/${locale}/sign-up`
          : `${serverPublicEnvConfigs.app_url}/sign-up`,
    },
  };
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  const configs = await readSettingsCached();

  return <SignUp configs={configs} callbackUrl={callbackUrl || '/'} />;
}
