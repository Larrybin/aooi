// data: admin session (RBAC) + users list (db) + roles/credits (db) + pagination/search
// cache: no-store (request-bound auth/RBAC)
// reason: admin data is user/role-specific; avoid caching across users
import { createAdminTablePage } from '@/surfaces/admin/create-admin-table-page';
import {
  AdminUsersListQuerySchema,
  type AdminUsersListQuery,
} from '@/surfaces/admin/schemas/list';

import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { Badge } from '@/shared/components/ui/badge';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUsers, getUsersCount, type User } from '@/shared/models/user';

export default createAdminTablePage<User, AdminUsersListQuery>({
  namespace: 'admin.users',
  permission: PERMISSIONS.USERS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.users' },
  ],
  search: {
    name: 'email',
    titleKey: 'list.search.email.title',
    placeholderKey: 'list.search.email.placeholder',
  },
  query: {
    schema: AdminUsersListQuerySchema,
    load: async ({ page, pageSize, email }) => {
      const [rows, total] = await Promise.all([
        getUsers({
          email,
          page,
          limit: pageSize,
        }),
        getUsersCount({
          email,
        }),
      ]);

      return { rows, total };
    },
  },
  columns: ({ t }) => [
    { name: 'id', title: t('fields.id'), type: 'copy' },
    { name: 'name', title: t('fields.name') },
    {
      name: 'image',
      title: t('fields.avatar'),
      type: 'image',
      placeholder: '-',
    },
    { name: 'email', title: t('fields.email'), type: 'copy' },
    {
      name: 'roles',
      title: t('fields.roles'),
      callback: async (item) => {
        const roles = await accessControlRuntimeDeps.listUserRoles(item.id);

        return (
          <div className="flex flex-col gap-2">
            {roles.map((role) => (
              <Badge key={role.id} variant="outline">
                {role.title}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      name: 'emailVerified',
      title: t('fields.email_verified'),
      type: 'label',
      placeholder: '-',
    },
    {
      name: 'remainingCredits',
      title: t('fields.remaining_credits'),
      callback: async (item) => {
        const credits = await getRemainingCredits(item.id);

        return <div className="text-green-500">{credits}</div>;
      },
    },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    {
      name: 'actions',
      title: t('fields.actions'),
      type: 'dropdown',
      callback: (item) => [
        {
          name: 'edit',
          title: t('list.buttons.edit'),
          icon: 'RiEditLine',
          url: `/admin/users/${item.id}/edit`,
        },
        {
          name: 'edit-roles',
          title: t('list.buttons.edit_roles'),
          icon: 'Users',
          url: `/admin/users/${item.id}/edit-roles`,
        },
      ],
    },
  ],
});
