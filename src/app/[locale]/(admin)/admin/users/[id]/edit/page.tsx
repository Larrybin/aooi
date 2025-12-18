import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { requirePermission } from '@/shared/services/rbac_guard';
import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { parseFormData } from '@/shared/lib/action/form';
import { requireActionPermission, requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { findUserById, updateUser, UpdateUser } from '@/shared/models/user';
import { AdminUserUpdateFormSchema } from '@/shared/schemas/actions/admin-user';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function UserEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Check if user has permission to edit posts
  await requirePermission({
    code: PERMISSIONS.USERS_WRITE,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const user = await findUserById(id);
  if (!user) {
    return <Empty message="User not found" />;
  }

  const t = await getTranslations('admin.users');

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.users'), url: '/admin/users' },
    { title: t('edit.crumbs.edit'), is_active: true },
  ];

  const form: Form<typeof user, { user: typeof user }> = {
    fields: [
      {
        name: 'email',
        type: 'text',
        title: t('fields.email'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'name',
        type: 'text',
        title: t('fields.name'),
        validation: { required: true },
      },
      {
        name: 'image',
        type: 'upload_image',
        title: t('fields.avatar'),
      },
    ],
    passby: {
      user: user,
    },
    data: user,
    submit: {
      button: {
        title: t('edit.buttons.submit'),
      },
      handler: async (data, passby) => {
        'use server';

        return withAction(async () => {
          const admin = await requireActionUser();
          await requireActionPermission(admin.id, PERMISSIONS.USERS_WRITE);

          const user = await findUserById(id);
          if (!user) {
            throw new Error('User not found');
          }

          const { name, image } = parseFormData(data, AdminUserUpdateFormSchema);

          const newUser: UpdateUser = {
            name,
            image: image ?? '',
          };

          const result = await updateUser(user.id as string, newUser);

          if (!result) {
            throw new Error('update user failed');
          }

          return actionOk('user updated', '/admin/users');
        });
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
