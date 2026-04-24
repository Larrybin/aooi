// data: signed-in user (better-auth) + credits ledger (db) + pagination/filter
// cache: no-store (request-bound auth)
// reason: user-specific credits and history
import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import {
  ACCOUNT_CREDIT_TRANSACTION_TYPE,
  listOwnCreditsUseCase,
  readAccountRemainingCreditsUseCase,
  type AccountCreditRecord,
  type AccountCreditTransactionType,
} from '@/domains/account/application/use-cases';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { PanelCard } from '@/shared/blocks/panel';
import { TableCard } from '@/shared/blocks/table';
import type { Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

function toCreditTransactionType(
  value?: string
): AccountCreditTransactionType | undefined {
  if (!value || value === 'all') {
    return undefined;
  }

  if (value === ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT) {
    return ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT;
  }

  if (value === ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME) {
    return ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME;
  }

  return undefined;
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number; type?: string }>;
}) {
  const { page: pageNum, pageSize, type } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;
  const transactionType = toCreditTransactionType(type);

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.credits');
  const result = await listOwnCreditsUseCase(
    {
      userId: user.id,
      transactionType,
      page,
      limit,
    },
    accountRuntimeDeps
  );

  const table: Table<AccountCreditRecord> = {
    title: t('list.title'),
    columns: [
      {
        name: 'transactionNo',
        title: t('fields.transaction_no'),
        type: 'copy',
      },
      { name: 'description', title: t('fields.description') },
      {
        name: 'transactionType',
        title: t('fields.type'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      {
        name: 'transactionScene',
        title: t('fields.scene'),
        type: 'label',
        placeholder: '-',
        metadata: { variant: 'outline' },
      },
      {
        name: 'credits',
        title: t('fields.credits'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      {
        name: 'expiresAt',
        title: t('fields.expires_at'),
        type: 'time',
        placeholder: '-',
        metadata: { format: 'YYYY-MM-DD HH:mm:ss' },
      },
      {
        name: 'createdAt',
        title: t('fields.created_at'),
        type: 'time',
      },
    ],
    data: result.data,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
    },
  };

  const remainingCredits = await readAccountRemainingCreditsUseCase(
    user.id,
    accountRuntimeDeps
  );

  const tabs: Tab[] = [
    {
      title: t('list.tabs.all'),
      name: 'all',
      url: '/settings/credits',
      is_active: !type || type === 'all',
    },
    {
      title: t('list.tabs.grant'),
      name: 'grant',
      url: '/settings/credits?type=grant',
      is_active: type === 'grant',
    },
    {
      title: t('list.tabs.consume'),
      name: 'consume',
      url: '/settings/credits?type=consume',
      is_active: type === 'consume',
    },
  ];

  return (
    <div className="space-y-8">
      <PanelCard
        title={t('view.title')}
        buttons={[
          {
            title: t('view.buttons.purchase'),
            url: '/pricing',
            target: '_blank',
            icon: 'Coins',
          },
        ]}
        className="max-w-md"
      >
        <div className="text-primary text-3xl font-bold">
          {remainingCredits}
        </div>
      </PanelCard>
      <TableCard title={t('list.title')} tabs={tabs} table={table} />
    </div>
  );
}
