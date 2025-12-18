import { getTranslations, setRequestLocale } from 'next-intl/server';
import { eq } from 'drizzle-orm';

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
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function RoleRestorePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.ROLES_WRITE,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.roles');

  const [roleRow] = await db().select().from(role).where(eq(role.id, id));
  if (!roleRow) {
    return <Empty message="Role not found" />;
  }

  if (!roleRow.deletedAt) {
    return <Empty message="Role is not deleted" />;
  }

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.roles'), url: '/admin/roles?includeDeleted=1' },
    { title: t('restore.crumbs.restore'), is_active: true },
  ];

  const form: Form<typeof roleRow, { role: typeof roleRow }> = {
    title: t('restore.title'),
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
        name: 'deletedAt',
        type: 'text',
        title: t('fields.deleted_at'),
        validation: { required: true },
        attributes: { disabled: true },
      },
    ],
    passby: { role: roleRow },
    data: roleRow,
    submit: {
      button: {
        title: t('restore.buttons.submit'),
      },
      handler: async (data) => {
        'use server';

        return withAction(async () => {
          const admin = await requireActionUser();
          await requireActionPermission(admin.id, PERMISSIONS.ROLES_WRITE);

          const [roleRow] = await db().select().from(role).where(eq(role.id, id));
          if (!roleRow) {
            throw new Error('Role not found');
          }
          if (!roleRow.deletedAt) {
            throw new Error('Role is not deleted');
          }

          try {
            await db()
              .update(role)
              .set({ deletedAt: null, updatedAt: new Date() })
              .where(eq(role.id, id));
          } catch (error) {
            throw new Error(
              'restore role failed: another active role with the same name may already exist'
            );
          }

          return actionOk('role restored', '/admin/roles?includeDeleted=1');
        });
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('restore.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
