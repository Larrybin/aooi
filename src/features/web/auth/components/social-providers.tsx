'use client';

import { useLocale, useTranslations } from 'next-intl';
import { RiGithubFill, RiGoogleFill } from 'react-icons/ri';
import { toast } from 'sonner';

import { signIn, withAuthJsonRequest } from '@/core/auth/client';
import { normalizeSocialAuthorizationUrl } from '@/core/auth/social-authorization-url';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { normalizeCallbackUrl } from '@/shared/lib/callback-url';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import { cn } from '@/shared/lib/utils';
import type { AuthErrorContext } from '@/shared/types/auth-callback';
import type { Button as ButtonType } from '@/shared/types/blocks/common';

export function SocialProviders({
  configs,
  callbackUrl,
  loading,
  setLoading,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();

  const { setIsShowSignModal } = useAppContext();

  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const localizedCallbackUrl = localizeCallbackUrl({
    callbackUrl: safeCallbackUrl,
    locale,
    defaultLocale,
  });

  const handleSignIn = async ({ provider }: { provider: string }) => {
    const result = await signIn.social(
      {
        provider: provider,
        callbackURL: localizedCallbackUrl,
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

  if (configs.google_auth_enabled === 'true') {
    providers.push({
      name: 'google',
      title: t('google_sign_in_title'),
      icon: <RiGoogleFill />,
      onClick: () => handleSignIn({ provider: 'google' }),
    });
  }

  if (configs.github_auth_enabled === 'true') {
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
