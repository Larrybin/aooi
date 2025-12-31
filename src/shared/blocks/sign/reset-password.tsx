'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { resetPassword } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
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

export function ResetPassword({
  token,
  error,
  configs,
}: {
  token?: string;
  error?: string;
  configs: Record<string, string>;
}) {
  const t = useTranslations('common.sign');
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled);

  const showInvalidToken = error === 'INVALID_TOKEN';
  const showMissingToken = !token && !showInvalidToken;

  const handleReset = async () => {
    if (loading) {
      return;
    }

    if (!isEmailAuthEnabled || !token) {
      return;
    }

    if (!newPassword) {
      toast.error(t('new_password_required'));
      return;
    }

    if (!confirmPassword) {
      toast.error(t('confirm_password_required'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('password_mismatch'));
      return;
    }

    try {
      setLoading(true);
      await resetPassword({
        token,
        newPassword,
      });
      toast.success(t('reset_password_success'));
      router.push('/sign-in');
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || 'reset password failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full md:max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">
          <h1>{t('reset_password_title')}</h1>
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          <h2>{t('reset_password_description')}</h2>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isEmailAuthEnabled ? (
          <p className="text-sm text-neutral-500">
            {t('reset_password_disabled')}
          </p>
        ) : showInvalidToken ? (
          <p className="text-sm text-neutral-500">{t('invalid_reset_token')}</p>
        ) : showMissingToken ? (
          <p className="text-sm text-neutral-500">{t('missing_reset_token')}</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">{t('new_password_title')}</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder={t('new_password_placeholder')}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">
                {t('confirm_password_title')}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t('confirm_password_placeholder')}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              onClick={handleReset}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <p>{t('reset_password_submit')}</p>
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
