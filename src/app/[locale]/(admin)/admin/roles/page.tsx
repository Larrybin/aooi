import { getTranslations } from 'next-intl/server';
import { desc } from 'drizzle-orm';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { requirePermission } from '@/shared/services/rbac_guard';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { getRoles, type Role } from '@/shared/services/rbac';
import { db } from '@/core/db';
import { role } from '@/config/db/schema';
import { Button, Crumb } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function AdminRolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ includeDeleted?: string }>;
}) {
  const { locale } = await params;
  const { includeDeleted } = await searchParams;

  const shouldIncludeDeleted =
    includeDeleted === '1' || includeDeleted === 'true';

  // Check if user has permission to read users
  await requirePermission({
    code: PERMISSIONS.ROLES_READ,
    redirectUrl: `/admin/no-permission`,
    locale,
  });

  const roles = shouldIncludeDeleted
    ? await db().select().from(role).orderBy(desc(role.createdAt))
    : await getRoles();

  const t = await getTranslations('admin.roles');

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.roles'), is_active: true },
  ];

  const actions: Button[] = [
    shouldIncludeDeleted
      ? {
          title: t('list.buttons.hide_deleted'),
          url: '/admin/roles',
          variant: 'outline',
        }
      : {
          title: t('list.buttons.show_deleted'),
          url: '/admin/roles?includeDeleted=1',
          variant: 'outline',
        },
  ];

  const table: Table<Role> = {
    columns: [
      { name: 'name', title: t('fields.name') },
      { name: 'title', title: t('fields.title') },
      { name: 'description', title: t('fields.description'), type: 'copy' },
      { name: 'status', title: t('fields.status'), type: 'label' },
      { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
      ...(shouldIncludeDeleted
        ? [
            {
              name: 'deletedAt',
              title: t('fields.deleted_at'),
              type: 'time' as const,
            },
          ]
        : []),
      {
        name: 'actions',
        title: t('fields.actions'),
        type: 'dropdown',
        callback: (item: Role) => {
          if (item.deletedAt) {
            if (!shouldIncludeDeleted) {
              return [];
            }

            return [
              {
                name: 'restore',
                title: t('list.buttons.restore'),
                icon: 'RiRefreshLine',
                url: `/admin/roles/${item.id}/restore`,
              },
            ];
          }

          return [
            {
              name: 'edit',
              title: t('list.buttons.edit'),
              icon: 'RiEditLine',
              url: `/admin/roles/${item.id}/edit`,
            },
            {
              name: 'edit_permissions',
              title: t('list.buttons.edit_permissions'),
              icon: 'RiEditLine',
              url: `/admin/roles/${item.id}/edit-permissions`,
            },
            {
              name: 'delete',
              title: t('list.buttons.delete'),
              icon: 'RiDeleteBinLine',
              url: `/admin/roles/${item.id}/delete`,
            },
          ];
        },
      },
    ],
    data: roles,
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('list.title')} actions={actions} />
        <TableCard table={table} />
      </Main>
    </>
  );
}
