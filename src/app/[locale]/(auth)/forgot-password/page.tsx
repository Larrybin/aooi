// data: request locale (next-intl) + auth configs (unstable_cache tag=db-configs, revalidate=60s)
// cache: dynamic (locale-aware); configs cached via unstable_cache
// reason: password recovery flow needs locale + brand settings; avoid per-request db reads
import { ForgotPassword } from '@/domains/account/ui/auth/forgot-password';
import { getTranslations } from 'next-intl/server';

import { buildCanonicalUrl } from '@/infra/url/canonical';
import { readAuthUiRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';

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
      canonical: buildCanonicalUrl('/forgot-password', locale),
    },
  };
}

export default async function ForgotPasswordPage() {
  const authSettings = await readAuthUiRuntimeSettingsCached();
  return <ForgotPassword authSettings={authSettings} />;
}
