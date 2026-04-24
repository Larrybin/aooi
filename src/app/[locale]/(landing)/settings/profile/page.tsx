// data: signed-in user (better-auth) + profile form (Server Action writes to db)
// cache: no-store (request-bound auth)
// reason: user-specific settings page
import { requireActionUser } from '@/app/access-control/action-guard';
import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { updateProfileUseCase } from '@/domains/account/application/use-cases';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { parseFormData } from '@/shared/lib/action/form';
import { withAction } from '@/shared/lib/action/with-action';
import { SettingsProfileFormSchema } from '@/shared/schemas/actions/settings-profile';
import type { Form as FormType } from '@/shared/types/blocks/form';

const log = createUseCaseLogger({
  domain: 'account',
  useCase: 'profile-settings-page',
});

export default async function ProfilePage() {
  const t = await getTranslations('settings.profile');

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={t('no_auth')} />;
  }

  const form = {
    fields: [
      {
        name: 'email',
        title: t('fields.email'),
        type: 'email',
        attributes: { disabled: true },
      },
      { name: 'name', title: t('fields.name'), type: 'text' },
      {
        name: 'image',
        title: t('fields.avatar'),
        type: 'upload_image',
        metadata: {
          max: 1,
        },
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
          const t = await getTranslations('settings.profile');

          const user = await requireActionUser();
          const { name, image } = parseFormData(
            data,
            SettingsProfileFormSchema,
            {
              message: t('validation.name_required'),
            }
          );

          const imageValue = data.get('image');
          log.debug('settings: profile update image field received', {
            operation: 'update-profile-image',
            route: '/settings/profile',
            imageType: typeof imageValue,
            isNull: imageValue === null,
            isString: typeof imageValue === 'string',
          });

          return updateProfileUseCase(
            {
              userId: user.id,
              name,
              image: image ?? '',
            },
            accountRuntimeDeps,
            t('messages.updated'),
            '/settings/profile'
          );
        });
      },
      button: {
        title: t('edit.buttons.submit'),
      },
    },
  } satisfies FormType;

  return (
    <div className="space-y-8" data-testid="settings-profile-page">
      <FormCard
        title={t('edit.title')}
        description={t('edit.description')}
        form={form}
      />
    </div>
  );
}
