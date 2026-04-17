// data: admin session (RBAC) + permissions list (db)
// cache: no-store (request-bound auth/RBAC)
// reason: permission catalog is admin-only; avoid caching across users/roles
import { createAdminTablePage } from '@/features/admin/create-admin-table-page';
import {
  AdminPermissionsListQuerySchema,
  type AdminPermissionsListQuery,
} from '@/features/admin/schemas/list';

import { listPermissions, type PermissionRecord } from '@/core/rbac';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<
  PermissionRecord,
  AdminPermissionsListQuery
>({
  namespace: 'admin.permissions',
  permission: PERMISSIONS.PERMISSIONS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.permissions' },
  ],
  query: {
    schema: AdminPermissionsListQuerySchema,
    load: async () => ({
      rows: await listPermissions(),
    }),
  },
  columns: ({ t }) => [
    { name: 'code', title: t('fields.code') },
    { name: 'title', title: t('fields.title') },
    { name: 'resource', title: t('fields.resource') },
    { name: 'action', title: t('fields.action') },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
  ],
});
