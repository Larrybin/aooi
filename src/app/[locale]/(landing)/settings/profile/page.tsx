import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { FormCard } from '@/shared/blocks/form';
import { parseFormData } from '@/shared/lib/action/form';
import { requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { logger } from '@/shared/lib/logger.server';
import { getUserInfo, UpdateUser, updateUser } from '@/shared/models/user';
import { SettingsProfileFormSchema } from '@/shared/schemas/actions/settings-profile';
import { Form as FormType } from '@/shared/types/blocks/form';

export default async function ProfilePage() {
  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.profile');

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
          const user = await requireActionUser();
          const { name, image } = parseFormData(
            data,
            SettingsProfileFormSchema,
            {
              message: 'name is required',
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

          return actionOk('Profile updated', '/settings/profile');
        });
      },
      button: {
        title: t('edit.buttons.submit'),
      },
    },
  } satisfies FormType;

  return (
    <div className="space-y-8">
      <FormCard
        title={t('edit.title')}
        description={t('edit.description')}
        form={form}
      />
    </div>
  );
}
