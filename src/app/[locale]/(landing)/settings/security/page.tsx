import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { PanelCard } from '@/shared/blocks/panel';
import { parseFormData } from '@/shared/lib/action/form';
import { requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { getUserInfo } from '@/shared/models/user';
import { SettingsSecurityFormSchema } from '@/shared/schemas/actions/settings-security';
import { Button as ButtonType } from '@/shared/types/blocks/common';
import { Form as FormType } from '@/shared/types/blocks/form';

export default async function SecurityPage() {
  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.security');

  const form = {
    fields: [
      {
        name: 'email',
        title: t('fields.email'),
        type: 'email',
        attributes: { disabled: true },
      },
      {
        name: 'password',
        title: t('fields.password'),
        type: 'password',
        attributes: { type: 'password' },
        validation: { required: true },
      },
      {
        name: 'new_password',
        title: t('fields.new_password'),
        type: 'password',
        validation: { required: true },
      },
      {
        name: 'confirm_password',
        title: t('fields.confirm_password'),
        type: 'password',
        validation: { required: true },
      },
    ],
    data: user,
    passby: {
      user: user,
    },
    submit: {
      handler: async (data: FormData, _passby: unknown) => {
        'use server';

        return withAction(async () => {
          const user = await requireActionUser();
          parseFormData(data, SettingsSecurityFormSchema, {
            message: 'password is required',
          });

          return actionOk('Profile updated', '/settings/profile');
        });
      },
      button: {
        title: t('reset_password.buttons.submit'),
      },
    },
  } satisfies FormType;

  return (
    <div className="space-y-8">
      <PanelCard
        title={t('reset_password.title')}
        description={t('reset_password.description')}
        content={t('reset_password.tip')}
        buttons={[
          {
            title: t('reset_password.buttons.submit'),
            url: '/settings/security',
            target: '_self',
            variant: 'default',
            size: 'sm',
            icon: 'RiLockPasswordLine',
          },
        ]}
        className="max-w-md"
      />
      <PanelCard
        title={t('delete_account.title')}
        description={t('delete_account.description')}
        content={t('delete_account.tip')}
        buttons={[
          {
            title: t('delete_account.buttons.submit'),
            url: '/settings/security',
            target: '_self',
            variant: 'destructive',
            size: 'sm',
            icon: 'RiDeleteBinLine',
          },
        ]}
        className="max-w-md"
      />
    </div>
  );
}
