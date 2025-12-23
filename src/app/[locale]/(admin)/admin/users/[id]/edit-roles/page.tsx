import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { buildAdminCrumbs, setupAdminPage } from '@/shared/lib/admin';
import { findUserById } from '@/shared/models/user';
import { getRoles, getUserRoles } from '@/shared/services/rbac';
import { requireAllPermissions } from '@/shared/services/rbac_guard';
import type { Form } from '@/shared/types/blocks/form';

import { updateUserRolesAction } from '../../actions';

export default async function UserEditRolesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // This page requires multiple permissions, use requireAllPermissions directly
  await setupAdminPage({
    locale,
    permission: PERMISSIONS.USERS_WRITE,
  });
  await requireAllPermissions({
    codes: [PERMISSIONS.USERS_WRITE, PERMISSIONS.ROLES_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const user = await findUserById(id);
  if (!user) {
    return <Empty message="User not found" />;
  }

  const t = await getTranslations('admin.users');

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit_roles.crumbs.admin', url: '/admin' },
    { key: 'edit_roles.crumbs.users', url: '/admin/users' },
    { key: 'edit_roles.crumbs.edit_roles' },
  ]);

  const roles = await getRoles();
  const rolesOptions = roles.map((role) => ({
    title: role.title,
    description: role.description,
    value: role.id,
  }));

  const userRoles = await getUserRoles(user.id as string);
  const userRoleIds = userRoles.map((role) => role.id);

  const form: Form<typeof user & { roles: string[] }, { user: typeof user }> = {
    fields: [
      {
        name: 'email',
        type: 'text',
        title: t('fields.email'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'roles',
        type: 'checkbox',
        title: t('fields.roles'),
        options: rolesOptions,
        validation: { required: true },
      },
    ],
    passby: {
      user,
    },
    data: {
      ...user,
      roles: userRoleIds,
    },
    submit: {
      button: {
        title: t('edit_roles.buttons.submit'),
      },
      handler: updateUserRolesAction.bind(null, id),
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit_roles.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
