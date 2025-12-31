'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { requestPasswordReset } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
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
import { toErrorMessage } from '@/shared/lib/errors';

export function ForgotPassword({
  configs,
}: {
  configs: Record<string, string>;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled);

  const redirectTo = useMemo(() => {
    const baseUrl =
      envConfigs.app_url ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const resetPath =
      locale !== defaultLocale
        ? `/${locale}/reset-password`
        : '/reset-password';
    return new URL(resetPath, baseUrl).toString();
  }, [locale]);

  const handleRequestReset = async () => {
    if (loading) {
      return;
    }

    if (!email) {
      toast.error(t('email_required'));
      return;
    }

    try {
      setLoading(true);
      await requestPasswordReset({
        email,
        redirectTo,
      });
      toast.success(t('forgot_password_sent'));
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || 'request password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full md:max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">
          <h1>{t('forgot_password_title')}</h1>
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          <h2>{t('forgot_password_description')}</h2>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isEmailAuthEnabled ? (
          <p className="text-sm text-neutral-500">
            {t('forgot_password_disabled')}
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t('email_title')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('email_placeholder')}
                required
                onChange={(e) => setEmail(e.target.value)}
                value={email}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              onClick={handleRequestReset}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <p>{t('forgot_password_submit')}</p>
              )}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex w-full justify-center border-t py-4">
          <p className="text-center text-xs text-neutral-500">
            <Link href="/sign-in" className="underline">
              <span className="cursor-pointer">{t('back_to_sign_in')}</span>
            </Link>
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
