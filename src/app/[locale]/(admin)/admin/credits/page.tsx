// data: admin session (RBAC) + credits ledger (db) + pagination/filter
// cache: no-store (request-bound auth/RBAC)
// reason: billing/credits data is sensitive; avoid caching across users/roles
import { createAdminTablePage } from '@/features/admin/create-admin-table-page';
import {
  AdminCreditsListQuerySchema,
  type AdminCreditsListQuery,
} from '@/features/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import {
  CreditStatus,
  CreditTransactionType,
  getCredits,
  getCreditsCount,
  type Credit,
} from '@/shared/models/credit';

export default createAdminTablePage<Credit, AdminCreditsListQuery>({
  namespace: 'admin.credits',
  permission: PERMISSIONS.CREDITS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.credits' },
  ],
  tabs: [
    { name: 'all', titleKey: 'list.tabs.all' },
    {
      name: CreditTransactionType.GRANT,
      titleKey: 'list.tabs.grant',
      queryPatch: { type: CreditTransactionType.GRANT },
    },
    {
      name: CreditTransactionType.CONSUME,
      titleKey: 'list.tabs.consume',
      queryPatch: { type: CreditTransactionType.CONSUME },
    },
  ],
  query: {
    schema: AdminCreditsListQuerySchema,
    load: async ({ page, pageSize, type }) => {
      const [rows, total] = await Promise.all([
        getCredits({
          transactionType: type as CreditTransactionType | undefined,
          status: CreditStatus.ACTIVE,
          getUser: true,
          page,
          limit: pageSize,
        }),
        getCreditsCount({
          transactionType: type as CreditTransactionType | undefined,
          status: CreditStatus.ACTIVE,
        }),
      ]);

      return { rows, total };
    },
  },
  columns: ({ t }) => [
    {
      name: 'transactionNo',
      title: t('fields.transaction_no'),
      type: 'copy',
    },
    { name: 'user', title: t('fields.user'), type: 'user' },
    {
      name: 'credits',
      title: t('fields.amount'),
      callback: (item) => {
        if (item.credits > 0) {
          return <div className="text-green-500">+{item.credits}</div>;
        }

        return <div className="text-red-500">{item.credits}</div>;
      },
    },
    {
      name: 'remainingCredits',
      title: t('fields.remaining'),
      type: 'label',
      placeholder: '-',
    },
    { name: 'transactionType', title: t('fields.type') },
    { name: 'transactionScene', title: t('fields.scene'), placeholder: '-' },
    { name: 'description', title: t('fields.description'), placeholder: '-' },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    {
      name: 'expiresAt',
      title: t('fields.expires_at'),
      type: 'time',
      placeholder: '-',
      metadata: { format: 'YYYY-MM-DD HH:mm:ss' },
    },
    {
      name: 'metadata',
      title: t('fields.metadata'),
      type: 'json_preview',
      placeholder: '-',
    },
  ],
});
