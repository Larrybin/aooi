// data: signed-in user (better-auth) + Server Action creates apikey (db)
// cache: no-store (request-bound auth)
// reason: user-specific write flow
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { FormCard } from '@/shared/blocks/form';
import { parseFormData } from '@/shared/lib/action/form';
import { requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { getNonceStr, getUuid } from '@/shared/lib/hash';
import {
  ApikeyStatus,
  createApikey,
  type NewApikey,
} from '@/shared/models/apikey';
import { getUserInfo } from '@/shared/models/user';
import { SettingsApiKeyUpsertFormSchema } from '@/shared/schemas/actions/settings-apikey';
import type { Crumb } from '@/shared/types/blocks/common';
import type { Form as FormType } from '@/shared/types/blocks/form';

export default async function CreateApiKeyPage() {
  const user = await getUserInfo();
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

          const key = `sk-${getNonceStr(32)}`;

          const newApikey: NewApikey = {
            id: getUuid(),
            userId: user.id,
            title,
            key,
            status: ApikeyStatus.ACTIVE,
          };

          await createApikey(newApikey);

          return actionOk('API Key created', '/settings/apikeys');
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
