// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s) + callbackUrl (query)
// cache: dynamic (request-based searchParams); configs cached via unstable_cache
// reason: public auth entry; support callback redirects without cross-request caching
import { SignIn } from '@/features/web/auth/components/sign-in';
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
    title: `${t('sign.sign_in_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical:
        locale !== defaultLocale
          ? `${serverPublicEnvConfigs.app_url}/${locale}/sign-in`
          : `${serverPublicEnvConfigs.app_url}/sign-in`,
    },
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  const configs = await getConfigs();

  return <SignIn configs={configs} callbackUrl={callbackUrl || '/'} />;
}
