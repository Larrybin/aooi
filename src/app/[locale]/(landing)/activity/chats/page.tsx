// data: signed-in user (better-auth) + chats list (db) + pagination
// cache: no-store (request-bound auth)
// reason: user-specific activity history
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { TableCard } from '@/shared/blocks/table';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import {
  listMemberChatsQuery,
  type MemberChatRow,
} from '@/domains/chat/application/member-chats.query';
import type { Button } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number }>;
}) {
  if (!isAiEnabled(await getPublicConfigsCached())) {
    notFound();
  }

  const { page: pageNum, pageSize } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const t = await getTranslations('activity.chats');

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={t('errors.no_auth')} />;
  }

  const { rows: chats, total } = await listMemberChatsQuery({
    userId: user.id,
    page,
    limit,
  });

  const table: Table<MemberChatRow> = {
    title: t('list.title'),
    columns: [
      { name: 'title', title: t('fields.title'), type: 'copy' },
      // { name: 'status', title: t('fields.status'), type: 'label' },
      { name: 'model', title: t('fields.model'), type: 'label' },
      { name: 'provider', title: t('fields.provider'), type: 'label' },
      { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
      {
        name: 'action',
        title: t('fields.action'),
        type: 'dropdown',
        callback: (item: MemberChatRow) => {
          const items: Button[] = [
            {
              title: t('list.buttons.view'),
              url: `/chat/${item.id}`,
              target: '_blank',
              icon: 'RiEyeLine',
            },
          ];

          return items;
        },
      },
    ],
    data: chats,
    emptyMessage: t('list.empty_message'),
    pagination: {
      total,
      page,
      limit,
    },
  };

  const buttons: Button[] = [
    {
      title: t('list.buttons.new'),
      url: '/chat',
      target: '_blank',
      icon: 'Plus',
    },
  ];

  return (
    <div className="space-y-8">
      <TableCard title={t('list.title')} table={table} buttons={buttons} />
    </div>
  );
}
