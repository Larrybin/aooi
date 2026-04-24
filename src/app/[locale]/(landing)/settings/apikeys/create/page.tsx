// data: signed-in user (better-auth) + Server Action creates apikey (db)
// cache: no-store (request-bound auth)
// reason: user-specific write flow
import { requireActionUser } from '@/app/access-control/action-guard';
import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { createOwnApikeyUseCase } from '@/domains/account/application/use-cases';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { parseFormData } from '@/shared/lib/action/form';
import { withAction } from '@/shared/lib/action/with-action';
import { SettingsApiKeyUpsertFormSchema } from '@/shared/schemas/actions/settings-apikey';
import type { Crumb } from '@/shared/types/blocks/common';
import type { Form as FormType } from '@/shared/types/blocks/form';

export default async function CreateApiKeyPage() {
  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.apikeys');

  const form = {
    title: t('add.title'),
    fields: [
      {
        name: 'title',
        title: t('fields.title'),
        type: 'text',
        placeholder: '',
        validation: { required: true },
      },
    ],
    passby: {
      user: user,
    },
    submit: {
      handler: async (data: FormData, _passby: unknown) => {
        'use server';

        return withAction(async () => {
          const user = await requireActionUser();
          const { title } = parseFormData(
            data,
            SettingsApiKeyUpsertFormSchema,
            {
              message: 'title is required',
            }
          );
          return createOwnApikeyUseCase(
            {
              userId: user.id,
              title,
            },
            accountRuntimeDeps,
            'API Key created',
            '/settings/apikeys'
          );
        });
      },
      button: {
        title: t('add.buttons.submit'),
      },
    },
  } satisfies FormType;

  const crumbs: Crumb[] = [
    {
      title: t('add.crumbs.apikeys'),
      url: '/settings/apikeys',
    },
    {
      title: t('add.crumbs.add'),
      is_active: true,
    },
  ];

  return (
    <div className="space-y-8">
      <FormCard title={t('add.title')} crumbs={crumbs} form={form} />
    </div>
  );
}
