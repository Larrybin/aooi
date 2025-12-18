import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import {
  requireAllPermissions,
  requirePermission,
} from '@/shared/services/rbac_guard';
import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { jsonStringArraySchema, parseFormData } from '@/shared/lib/action/form';
import { requireActionPermissions, requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { findUserById } from '@/shared/models/user';
import {
  assignRolesToUser,
  getRoles,
  getUserRoles,
} from '@/shared/services/rbac';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function UserEditRolesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Check if user has permission to edit posts
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

  const crumbs: Crumb[] = [
    { title: t('edit_roles.crumbs.admin'), url: '/admin' },
    { title: t('edit_roles.crumbs.users'), url: '/admin/users' },
    { title: t('edit_roles.crumbs.edit_roles'), is_active: true },
  ];

  const roles = await getRoles();
  const rolesOptions = roles.map((role) => ({
    title: role.title,
    description: role.description,
    value: role.id,
  }));

  const userRoles = await getUserRoles(user.id as string);
  const userRoleIds = userRoles.map((role) => role.id);

  const form: Form<
    typeof user & { roles: string[] },
    { user: typeof user }
  > = {
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
      handler: async (data, passby) => {
        'use server';

        return withAction(async () => {
          const admin = await requireActionUser();
          await requireActionPermissions(
            admin.id,
            PERMISSIONS.USERS_WRITE,
            PERMISSIONS.ROLES_WRITE
          );

          const user = await findUserById(id);
          if (!user) {
            throw new Error('User not found');
          }

          const schema = z.object({ roles: jsonStringArraySchema });
          const { roles } = parseFormData(data, schema, {
            message: 'invalid roles',
          });

          await assignRolesToUser(user.id as string, roles);

          return actionOk('roles updated', '/admin/users');
        });
      },
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
