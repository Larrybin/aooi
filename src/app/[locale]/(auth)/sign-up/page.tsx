// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s) + callbackUrl (query)
// cache: dynamic (request-based searchParams); configs cached via unstable_cache
// reason: public auth entry; support callback redirects without cross-request caching
import { SignUp } from '@/domains/account/ui/auth/sign-up';
import { getTranslations } from 'next-intl/server';

import { buildCanonicalUrl } from '@/infra/url/canonical';
import {
  readAuthUiRuntimeSettingsCached,
  readPublicUiConfigCached,
} from '@/domains/settings/application/settings-runtime.query';

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
      canonical: buildCanonicalUrl('/sign-up', locale),
    },
  };
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  const [authSettings, publicUiConfig] = await Promise.all([
    readAuthUiRuntimeSettingsCached(),
    readPublicUiConfigCached(),
  ]);

  return (
    <SignUp
      authSettings={authSettings}
      publicUiConfig={publicUiConfig}
      callbackUrl={callbackUrl || '/'}
    />
  );
}
