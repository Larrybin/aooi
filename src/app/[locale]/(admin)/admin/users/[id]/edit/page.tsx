// data: admin session (RBAC) + user record (db) + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: user edit form is permission-gated and user-specific
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { buildAdminCrumbs, setupAdminPage } from '@/shared/lib/admin';
import { findUserById } from '@/shared/models/user';
import type { Form } from '@/shared/types/blocks/form';

import { updateUserAction } from '../../actions';

export default async function UserEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.USERS_WRITE,
  });

  const user = await findUserById(id);
  if (!user) {
    return <Empty message="User not found" />;
  }

  const t = await getTranslations('admin.users');

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit.crumbs.admin', url: '/admin' },
    { key: 'edit.crumbs.users', url: '/admin/users' },
    { key: 'edit.crumbs.edit' },
  ]);

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
      handler: updateUserAction.bind(null, id),
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
