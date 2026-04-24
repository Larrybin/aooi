'use client';

import { useState, useSyncExternalStore } from 'react';
import type {
  AuthUiRuntimeSettings,
  PublicUiConfig,
} from '@/domains/settings/application/settings-runtime.contracts';
import { signUp, withAuthJsonRequest } from '@/infra/platform/auth/client';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { normalizeCallbackUrl } from '@/shared/lib/callback-url';
import { toErrorMessage } from '@/shared/lib/errors';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import type { AuthErrorContext } from '@/shared/types/auth-callback';

import { reportSignUpAffiliate } from './report-sign-up-affiliate';
import { SocialProviders } from './social-providers';

function subscribeToHydration() {
  return () => undefined;
}

export function SignUp({
  authSettings,
  publicUiConfig,
  callbackUrl = '/',
}: {
  authSettings: AuthUiRuntimeSettings;
  publicUiConfig: PublicUiConfig;
  callbackUrl: string;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const clientReady = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  const isEmailAuthEnabled = authSettings.emailAuthEnabled;

  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const localizedCallbackUrl = localizeCallbackUrl({
    callbackUrl: safeCallbackUrl,
    locale,
    defaultLocale,
  });

  const handleSignUp = async () => {
    if (loading) {
      return;
    }

    if (!name) {
      toast.error(t('name_required'));
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
      await signUp.email(
        {
          email,
          password,
          name,
        },
        withAuthJsonRequest({
          onRequest: () => {
            setLoading(true);
          },
          onResponse: () => {
            setLoading(false);
          },
          onSuccess: () => {
            reportSignUpAffiliate({
              uiConfig: publicUiConfig,
              userEmail: email,
            });

            if (typeof window !== 'undefined') {
              window.location.assign(localizedCallbackUrl);
            }
          },
          onError: (ctx: AuthErrorContext) => {
            toast.error(ctx.error?.message || t('sign_up_failed'));
            setLoading(false);
          },
        })
      );
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || t('sign_up_failed'));
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full md:max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">
          <h1>{t('sign_up_title')}</h1>
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          <h2>{t('sign_up_description')}</h2>
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
              data-auth-client-ready={clientReady ? 'true' : 'false'}
              data-testid="auth-sign-up-form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSignUp();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="name">{t('name_title')}</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder={t('name_placeholder')}
                  required
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                  value={name}
                />
              </div>

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
                <Label htmlFor="password">{t('password_title')}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t('password_placeholder')}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!clientReady || loading}
                data-testid="auth-sign-up-submit"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <p>{t('sign_up_title')}</p>
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
      </CardContent>
    </Card>
  );
}
