'use client';

import type { AuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { signIn, withAuthJsonRequest } from '@/infra/platform/auth/client';
import { normalizeSocialAuthorizationUrl } from '@/infra/platform/auth/social-authorization-url';
import { useLocale, useTranslations } from 'next-intl';
import { RiGithubFill, RiGoogleFill } from 'react-icons/ri';
import { toast } from 'sonner';

import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { usePublicAppContext } from '@/shared/contexts/app';
import {
  normalizeCallbackUrl,
  withCallbackUrl,
} from '@/shared/lib/callback-url';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import { cn } from '@/shared/lib/utils';
import type { AuthErrorContext } from '@/shared/types/auth-callback';
import type { Button as ButtonType } from '@/shared/types/blocks/common';

export function SocialProviders({
  authSettings,
  callbackUrl,
  loading,
  setLoading,
}: {
  authSettings: AuthUiRuntimeSettings;
  callbackUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();

  const { setIsShowSignModal } = usePublicAppContext();

  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const localizedCallbackUrl = localizeCallbackUrl({
    callbackUrl: safeCallbackUrl,
    locale,
    defaultLocale,
  });
  const localizedErrorCallbackUrl = localizeCallbackUrl({
    callbackUrl: withCallbackUrl('/sign-in', safeCallbackUrl),
    locale,
    defaultLocale,
  });

  const handleSignIn = async ({ provider }: { provider: string }) => {
    const result = await signIn.social(
      {
        provider,
        callbackURL: localizedCallbackUrl,
        errorCallbackURL: localizedErrorCallbackUrl,
        disableRedirect: true,
      },
      withAuthJsonRequest({
        onRequest: () => {
          setLoading(true);
        },
        onResponse: () => {
          setLoading(false);
        },
        onError: (ctx: AuthErrorContext) => {
          toast.error(ctx.error?.message || t('sign_in_failed'));
          setLoading(false);
        },
      })
    );

    if (result.error) {
      return;
    }

    const authorizationUrl = result.data?.url;
    if (!authorizationUrl) {
      toast.error(t('sign_in_failed'));
      return;
    }

    setIsShowSignModal(false);
    window.location.assign(
      normalizeSocialAuthorizationUrl({
        authorizationUrl,
        provider,
        runtimeOrigin: window.location.origin,
      })
    );
  };

  const providers: ButtonType[] = [];

  if (authSettings.googleAuthEnabled) {
    providers.push({
      name: 'google',
      title: t('google_sign_in_title'),
      icon: <RiGoogleFill />,
      onClick: () => handleSignIn({ provider: 'google' }),
    });
  }

  if (authSettings.githubAuthEnabled) {
    providers.push({
      name: 'github',
      title: t('github_sign_in_title'),
      icon: <RiGithubFill />,
      onClick: () => handleSignIn({ provider: 'github' }),
    });
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2',
        'flex-col justify-between'
      )}
    >
      {providers.map((provider) => (
        <Button
          key={provider.name}
          variant="outline"
          className={cn('w-full gap-2')}
          type="button"
          data-testid={`auth-social-${provider.name}`}
          disabled={loading}
          onClick={provider.onClick}
        >
          {provider.icon}
          <h3>{provider.title}</h3>
        </Button>
      ))}
    </div>
  );
}
