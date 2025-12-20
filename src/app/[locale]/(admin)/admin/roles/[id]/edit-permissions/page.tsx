import { getTranslations } from 'next-intl/server';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { buildAdminCrumbs, setupAdminPage } from '@/shared/lib/admin';
import {
  getPermissions,
  getRoleById,
  getRolePermissions,
} from '@/shared/services/rbac';
import { Form } from '@/shared/types/blocks/form';

import { updateRolePermissionsAction } from '../../actions';

export default async function RoleEditPermissionsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.ROLES_WRITE,
  });

  const role = await getRoleById(id);
  if (!role) {
    return <Empty message="Role not found" />;
  }

  const t = await getTranslations('admin.roles');

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit_permissions.crumbs.admin', url: '/admin' },
    { key: 'edit_permissions.crumbs.roles', url: '/admin/roles' },
    { key: 'edit_permissions.crumbs.edit_permissions' },
  ]);

  const permissions = await getPermissions();
  const permissionsOptions = permissions.map((permission) => ({
    title: permission.title,
    description: permission.code,
    value: permission.id,
  }));

  const rolePermissions = await getRolePermissions(role.id as string);
  const rolePermissionIds = rolePermissions.map((permission) => permission.id);

  const form: Form<
    typeof role & { permissions: string[] },
    { role: typeof role }
  > = {
    fields: [
      {
        name: 'name',
        type: 'text',
        title: t('fields.name'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'title',
        type: 'text',
        title: t('fields.title'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'permissions',
        type: 'checkbox',
        title: t('fields.permissions'),
        options: permissionsOptions,
        validation: { required: true },
      },
    ],
    passby: {
      role: role,
    },
    data: {
      ...role,
      permissions: rolePermissionIds,
    },
    submit: {
      button: {
        title: t('edit_permissions.buttons.submit'),
      },
      handler: updateRolePermissionsAction.bind(null, id),
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit_permissions.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
