// data: signed-in user (better-auth) + apikey record (db) + Server Action soft-deletes it
// cache: no-store (request-bound auth)
// reason: user-specific destructive write flow
import { getTranslations } from 'next-intl/server';

import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { requireActionUser } from '@/app/access-control/action-guard';
import {
  deleteOwnApikeyUseCase,
  requireOwnedApikeyUseCase,
} from '@/domains/account/application/use-cases';
import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { ActionError } from '@/shared/lib/action/errors';
import { parseFormData } from '@/shared/lib/action/form';
import { withAction } from '@/shared/lib/action/with-action';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { SettingsApiKeyUpsertFormSchema } from '@/shared/schemas/actions/settings-apikey';
import type { Crumb } from '@/shared/types/blocks/common';
import type { Form as FormType } from '@/shared/types/blocks/form';

export default async function DeleteApiKeyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const apikey = await requireOwnedApikeyUseCase(
    {
      apikeyId: id,
      userId: user.id,
    },
    accountRuntimeDeps
  );
  if (!apikey) {
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
          const apikey = await requireOwnedApikeyUseCase(
            {
              apikeyId: id,
              userId: user.id,
            },
            accountRuntimeDeps
          );
          if (!apikey) {
            throw new ActionError('no permission');
          }

          parseFormData(data, SettingsApiKeyUpsertFormSchema, {
            message: 'title is required',
          });
          const result = await deleteOwnApikeyUseCase(
            {
              apikeyId: apikey.id,
              userId: user.id,
            },
            accountRuntimeDeps,
            'API Key deleted',
            '/settings/apikeys'
          );
          if (!result) {
            throw new ActionError('no permission');
          }
          return result;
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
