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
import { getRoleById, updateRole, UpdateRole } from '@/shared/services/rbac';
import { AdminRoleUpdateFormSchema } from '@/shared/schemas/actions/admin-role';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function RoleEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Check if user has permission to edit posts
  await requirePermission({
    code: PERMISSIONS.ROLES_WRITE,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const role = await getRoleById(id as string);
  if (!role) {
    return <Empty message="Role not found" />;
  }

  const t = await getTranslations('admin.roles');

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.roles'), url: '/admin/roles' },
    { title: t('edit.crumbs.edit'), is_active: true },
  ];

  const form: Form<typeof role, { role: typeof role }> = {
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
      },
      {
        name: 'description',
        type: 'textarea',
        title: t('fields.description'),
        validation: { required: true },
      },
    ],
    passby: {
      role: role,
    },
    data: role,
    submit: {
      button: {
        title: t('edit.buttons.submit'),
      },
      handler: async (data, passby) => {
        'use server';

        return withAction(async () => {
          const user = await requireActionUser();
          await requireActionPermission(user.id, PERMISSIONS.ROLES_WRITE);

          const role = await getRoleById(id as string);
          if (!role) {
            throw new Error('Role not found');
          }

          const { title, description } = parseFormData(
            data,
            AdminRoleUpdateFormSchema
          );

          const newRole: UpdateRole = { title, description };

          const result = await updateRole(role.id as string, newRole);

          if (!result) {
            throw new Error('update role failed');
          }

          return actionOk('role updated', '/admin/roles');
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
