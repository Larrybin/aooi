import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/core/db';
import { role } from '@/config/db/schema';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { requirePermission } from '@/shared/services/rbac_guard';
import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import {
  requireActionPermission,
  requireActionUser,
} from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { deleteRole } from '@/shared/services/rbac';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function RoleDeletePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.ROLES_DELETE,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.roles');

  const [roleRow] = await db()
    .select()
    .from(role)
    .where(and(eq(role.id, id), isNull(role.deletedAt)));

  if (!roleRow) {
    return <Empty message="Role not found" />;
  }

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.roles'), url: '/admin/roles' },
    { title: t('delete.crumbs.delete'), is_active: true },
  ];

  const form: Form<typeof roleRow, { role: typeof roleRow }> = {
    title: t('delete.title'),
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
        name: 'description',
        type: 'textarea',
        title: t('fields.description'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'status',
        type: 'text',
        title: t('fields.status'),
        validation: { required: true },
        attributes: { disabled: true },
      },
    ],
    passby: { role: roleRow },
    data: roleRow,
    submit: {
      button: {
        title: t('delete.buttons.submit'),
        variant: 'destructive',
        icon: 'RiDeleteBinLine',
      },
      handler: async (data) => {
        'use server';

        return withAction(async () => {
          const admin = await requireActionUser();
          await requireActionPermission(admin.id, PERMISSIONS.ROLES_DELETE);

          const [roleRow] = await db()
            .select()
            .from(role)
            .where(and(eq(role.id, id), isNull(role.deletedAt)));
          if (!roleRow) {
            throw new Error('Role not found');
          }

          await deleteRole(id);

          return actionOk('role deleted', '/admin/roles');
        });
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('delete.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
