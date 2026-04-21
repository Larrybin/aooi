// data: signed-in user (better-auth) + apikeys list (db) + pagination
// cache: no-store (request-bound auth)
// reason: user-specific settings page
import { getTranslations } from 'next-intl/server';

import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import {
  listOwnApikeysUseCase,
  type AccountApikeyRecord,
} from '@/domains/account/application/use-cases';
import { Empty } from '@/shared/blocks/common/empty';
import { TableCard } from '@/shared/blocks/table';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import type { Button } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number }>;
}) {
  const { page: pageNum, pageSize } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.apikeys');
  const result = await listOwnApikeysUseCase(
    {
      userId: user.id,
      page,
      limit,
    },
    accountRuntimeDeps
  );

  const table: Table<AccountApikeyRecord> = {
    title: t('list.title'),
    columns: [
      {
        name: 'title',
        title: t('fields.title'),
      },
      { name: 'key', title: t('fields.key'), type: 'copy' },
      {
        name: 'createdAt',
        title: t('fields.created_at'),
        type: 'time',
      },
      {
        name: 'action',
        title: t('fields.action'),
        type: 'dropdown',
        callback: (item: AccountApikeyRecord) => {
          return [
            {
              title: t('list.buttons.edit'),
              url: `/settings/apikeys/${item.id}/edit`,
              icon: 'RiEditLine',
            },
            {
              title: t('list.buttons.delete'),
              url: `/settings/apikeys/${item.id}/delete`,
              icon: 'RiDeleteBinLine',
            },
          ];
        },
      },
    ],
    data: result.data,
    emptyMessage: t('list.empty_message'),
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
    },
  };

  const buttons: Button[] = [
    {
      title: t('list.buttons.add'),
      url: '/settings/apikeys/create',
      icon: 'Plus',
    },
  ];

  return (
    <div className="space-y-8">
      <TableCard title={t('list.title')} buttons={buttons} table={table} />
    </div>
  );
}
