// data: signed-in user (better-auth) + profile form (Server Action writes to db)
// cache: no-store (request-bound auth)
// reason: user-specific settings page
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { parseFormData } from '@/shared/lib/action/form';
import { requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import { logger } from '@/shared/lib/logger.server';
import { updateUser, type UpdateUser } from '@/shared/models/user';
import { SettingsProfileFormSchema } from '@/shared/schemas/actions/settings-profile';
import type { Form as FormType } from '@/shared/types/blocks/form';

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
          logger.debug('settings: profile update image field received', {
            route: '/settings/profile',
            imageType: typeof imageValue,
            isNull: imageValue === null,
            isString: typeof imageValue === 'string',
          });

          const updatedUser: UpdateUser = {
            name,
            image: image ?? '',
          };

          await updateUser(user.id, updatedUser);

          return actionOk(t('messages.updated'), '/settings/profile');
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
