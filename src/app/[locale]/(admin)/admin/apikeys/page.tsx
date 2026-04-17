// data: admin session (RBAC) + api keys list (db) + pagination
// cache: no-store (request-bound auth/RBAC)
// reason: api keys are sensitive; avoid caching across users/roles
import { createAdminTablePage } from '@/features/admin/server';
import {
  AdminApikeysListQuerySchema,
  type AdminApikeysListQuery,
} from '@/features/admin/schemas/list';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import {
  getApikeys,
  getApikeysCount,
  type Apikey,
} from '@/shared/models/apikey';

export default createAdminTablePage<Apikey, AdminApikeysListQuery>({
  namespace: 'admin.apikeys',
  permission: PERMISSIONS.APIKEYS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.apikeys' },
  ],
  query: {
    schema: AdminApikeysListQuerySchema,
    load: async ({ page, pageSize }) => {
      const [rows, total] = await Promise.all([
        getApikeys({
          getUser: true,
          page,
          limit: pageSize,
        }),
        getApikeysCount({}),
      ]);

      return { rows, total };
    },
  },
  columns: ({ t }) => [
    { name: 'title', title: t('fields.title') },
    { name: 'key', title: t('fields.key'), type: 'copy' },
    { name: 'user', title: t('fields.user'), type: 'user' },
    { name: 'status', title: t('fields.status'), type: 'label' },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
  ],
});
