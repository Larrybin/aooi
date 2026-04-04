// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s) + callbackUrl (query)
// cache: dynamic (request-based searchParams); configs cached via unstable_cache
// reason: public auth entry; support callback redirects without cross-request caching
import { SignUp } from '@/features/web/auth/components/sign-up';
import { getTranslations } from 'next-intl/server';

import { envConfigs } from '@/config';
import { defaultLocale } from '@/config/locale';
import { getConfigs } from '@/shared/models/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const t = await getTranslations('common');

  return {
    title: `${t('sign.sign_up_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical:
        locale !== defaultLocale
          ? `${envConfigs.app_url}/${locale}/sign-up`
          : `${envConfigs.app_url}/sign-up`,
    },
  };
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  const configs = await getConfigs();

  return <SignUp configs={configs} callbackUrl={callbackUrl || '/'} />;
}
