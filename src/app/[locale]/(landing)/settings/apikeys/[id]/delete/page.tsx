// data: signed-in user (better-auth) + apikey record (db) + Server Action soft-deletes it
// cache: no-store (request-bound auth)
// reason: user-specific destructive write flow
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { FormCard } from '@/shared/blocks/form';
import { ActionError } from '@/shared/lib/action/errors';
import { parseFormData } from '@/shared/lib/action/form';
import { requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import {
  ApikeyStatus,
  findApikeyById,
  updateApikey,
  type UpdateApikey,
} from '@/shared/models/apikey';
import { getUserInfo } from '@/shared/models/user';
import { SettingsApiKeyUpsertFormSchema } from '@/shared/schemas/actions/settings-apikey';
import type { Crumb } from '@/shared/types/blocks/common';
import type { Form as FormType } from '@/shared/types/blocks/form';

export default async function DeleteApiKeyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apikey = await findApikeyById(id);
  if (!apikey) {
    return <Empty message="API Key not found" />;
  }

  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  if (apikey.userId !== user.id) {
    return <Empty message="no permission" />;
  }

  const t = await getTranslations('settings.apikeys');

  const form = {
    title: t('delete.title'),
    fields: [
      {
        name: 'title',
        title: t('fields.title'),
        type: 'text',
        placeholder: '',
        validation: { required: true },
        attributes: {
          disabled: true,
        },
      },
      {
        name: 'key',
        title: t('fields.key'),
        type: 'text',
        placeholder: '',
        validation: { required: true },
        attributes: {
          disabled: true,
        },
      },
    ],
    passby: {
      user: user,
      apikey: apikey,
    },
    data: apikey,
    submit: {
      handler: async (data: FormData, _passby: unknown) => {
        'use server';

        return withAction(async () => {
          const user = await requireActionUser();
          const apikey = await findApikeyById(id);
          if (!apikey) {
            throw new ActionError('apikey not found');
          }

          if (apikey.userId !== user.id) {
            throw new ActionError('no permission');
          }

          parseFormData(data, SettingsApiKeyUpsertFormSchema, {
            message: 'title is required',
          });

          const updatedApikey: UpdateApikey = {
            status: ApikeyStatus.DELETED,
            deletedAt: new Date(),
          };

          await updateApikey(apikey.id, updatedApikey);

          return actionOk('API Key deleted', '/settings/apikeys');
        });
      },
      button: {
        title: t('delete.buttons.submit'),
        variant: 'destructive',
        icon: 'RiDeleteBinLine',
      },
    },
  } satisfies FormType;

  const crumbs: Crumb[] = [
    {
      title: t('delete.crumbs.apikeys'),
      url: '/settings/apikeys',
    },
    {
      title: t('delete.crumbs.delete'),
      is_active: true,
    },
  ];

  return (
    <div className="space-y-8">
      <FormCard title={t('delete.crumbs.delete')} crumbs={crumbs} form={form} />
    </div>
  );
}
