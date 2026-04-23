'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  signIn,
  withAuthJsonRequest,
} from '@/infra/platform/auth/client';
import { Link, useRouter } from '@/infra/platform/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { usePublicAppContext } from '@/shared/contexts/app';
import {
  normalizeCallbackUrl,
  withCallbackUrl,
} from '@/shared/lib/callback-url';
import { toErrorMessage } from '@/shared/lib/errors';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import type { AuthErrorContext } from '@/shared/types/auth-callback';

import { SocialProviders } from './social-providers';

export function SignInForm({
  callbackUrl = '/',
  className,
}: {
  callbackUrl: string;
  className?: string;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientReady, setClientReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const { authSettings, setIsShowSignModal } = usePublicAppContext();

  const isEmailAuthEnabled = authSettings.emailAuthEnabled;

  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const localizedCallbackUrl = localizeCallbackUrl({
    callbackUrl: safeCallbackUrl,
    locale,
    defaultLocale,
  });

  useEffect(() => {
    setClientReady(true);
  }, []);

  const handleSignIn = async () => {
    if (loading) {
      return;
    }

    if (!email) {
      toast.error(t('email_required'));
      return;
    }

    if (!password) {
      toast.error(t('password_required'));
      return;
    }

    try {
      setLoading(true);
      await signIn.email(
        {
          email,
          password,
          callbackURL: localizedCallbackUrl,
        },
        withAuthJsonRequest({
          onRequest: () => {
            setLoading(true);
          },
          onResponse: () => {
            setLoading(false);
          },
          onSuccess: () => {
            setIsShowSignModal(false);
            router.refresh();
          },
          onError: (ctx: AuthErrorContext) => {
            toast.error(ctx.error?.message || t('sign_in_failed'));
            setLoading(false);
          },
        })
      );
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || t('sign_in_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full md:max-w-md ${className}`}>
      <div className="grid gap-4">
        {isEmailAuthEnabled && (
          <form
            className="grid gap-4"
            data-auth-client-ready={clientReady ? 'true' : 'false'}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSignIn();
            }}
          >
            {safeCallbackUrl !== '/' ? (
              <p className="text-muted-foreground text-xs">
                {t('return_to', { path: localizedCallbackUrl })}
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="email">{t('email_title')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t('email_placeholder')}
                required
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                value={email}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">{t('password_title')}</Label>
                <Link
                  href="/forgot-password"
                  className="ml-auto inline-block text-sm underline"
                >
                  {t('forgot_password')}
                </Link>
              </div>

              <Input
                id="password"
                name="password"
                type="password"
                placeholder={t('password_placeholder')}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!clientReady || loading}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <p> {t('sign_in_title')} </p>
              )}
            </Button>
          </form>
        )}

        <SocialProviders
          authSettings={authSettings}
          callbackUrl={localizedCallbackUrl || '/'}
          loading={loading}
          setLoading={setLoading}
        />
      </div>
      {isEmailAuthEnabled && (
        <div className="flex w-full justify-center border-t py-4">
          <p className="text-center text-xs text-neutral-500">
            {t('no_account')}
            <Link
              href={withCallbackUrl('/sign-up', safeCallbackUrl)}
              className="underline"
            >
              <span className="cursor-pointer">{t('sign_up_title')}</span>
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
