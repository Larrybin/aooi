'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { signIn } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  normalizeCallbackUrl,
  withCallbackUrl,
} from '@/shared/lib/callback-url';
import { toErrorMessage } from '@/shared/lib/errors';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import type { AuthErrorContext } from '@/shared/types/auth-callback';

import { SocialProviders } from './social-providers';

export function SignIn({
  configs,
  callbackUrl = '/',
}: {
  configs: Record<string, string>;
  callbackUrl: string;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled); // no social providers enabled, auto enable email auth

  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const localizedCallbackUrl = localizeCallbackUrl({
    callbackUrl: safeCallbackUrl,
    locale,
    defaultLocale,
  });

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
      await signIn.email(
        {
          email,
          password,
          callbackURL: localizedCallbackUrl,
        },
        {
          onRequest: () => {
            setLoading(true);
          },
          onResponse: () => {
            setLoading(false);
          },
          onSuccess: () => {},
          onError: (ctx: AuthErrorContext) => {
            toast.error(ctx.error?.message || t('sign_in_failed'));
            setLoading(false);
          },
        }
      );
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || t('sign_in_failed'));
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/80 bg-card/95 mx-auto w-full shadow-xl shadow-slate-900/8 md:max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl md:text-3xl">
          <h1>{t('sign_in_title')}</h1>
        </CardTitle>
        <CardDescription className="text-sm md:text-base">
          <h2>{t('sign_in_description')}</h2>
          {safeCallbackUrl !== '/' ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {t('return_to', { path: localizedCallbackUrl })}
            </p>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {isEmailAuthEnabled && (
            <form
              className="grid gap-4"
              data-testid="auth-sign-in-form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSignIn();
              }}
            >
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
                    className="ml-auto inline-block text-sm underline underline-offset-4"
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
                />
              </div>

              {/* <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              onClick={() => {
                setRememberMe(!rememberMe);
              }}
            />
            <Label htmlFor="remember">Remember me</Label>
          </div> */}

              <Button
                type="submit"
                className="h-11 w-full rounded-full"
                disabled={loading}
                data-testid="auth-sign-in-submit"
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
            configs={configs}
            callbackUrl={localizedCallbackUrl || '/'}
            loading={loading}
            setLoading={setLoading}
          />
        </div>
      </CardContent>
      {isEmailAuthEnabled && (
        <CardFooter>
          <div className="flex w-full justify-center border-t py-4">
            <p className="text-center text-xs text-neutral-500">
              {t('no_account')}
              <Link
                href={withCallbackUrl('/sign-up', safeCallbackUrl)}
                className="underline underline-offset-4"
              >
                <span className="cursor-pointer">{t('sign_up_title')}</span>
              </Link>
            </p>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
