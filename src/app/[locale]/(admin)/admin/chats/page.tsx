// data: admin session (RBAC) + chats list (db) + pagination
// cache: no-store (request-bound auth/RBAC)
// reason: chat logs are sensitive; avoid caching across users/roles
import { notFound } from 'next/navigation';

import { createAdminTablePage } from '@/features/admin/server';
import {
  AdminChatsListQuerySchema,
  type AdminChatsListQuery,
} from '@/features/admin/schemas/list';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { isAiEnabledCached } from '@/shared/lib/ai-enabled.server';
import { getChats, getChatsCount, type Chat } from '@/shared/models/chat';

export default createAdminTablePage<Chat, AdminChatsListQuery>({
  namespace: 'admin.chats',
  permission: PERMISSIONS.AITASKS_READ,
  beforeLoad: async () => {
    if (!(await isAiEnabledCached())) {
      notFound();
    }
  },
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.chats' },
  ],
  query: {
    schema: AdminChatsListQuerySchema,
    load: async ({ page, pageSize }) => {
      const [rows, total] = await Promise.all([
        getChats({
          page,
          limit: pageSize,
          getUser: true,
        }),
        getChatsCount({}),
      ]);

      return { rows, total };
    },
  },
  columns: ({ t }) => [
    { name: 'title', title: t('fields.title'), type: 'copy' },
    { name: 'user', title: t('fields.user'), type: 'user' },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    { name: 'status', title: t('fields.status'), type: 'label' },
    { name: 'model', title: t('fields.model'), type: 'label' },
    { name: 'provider', title: t('fields.provider'), type: 'label' },
    {
      name: 'action',
      title: t('fields.action'),
      type: 'dropdown',
      callback: (item) => [
        {
          title: t('list.buttons.view'),
          url: `/chat/${item.id}`,
          target: '_blank',
          icon: 'RiEyeLine',
        },
      ],
    },
  ],
});
