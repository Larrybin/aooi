import { getChats, getChatsCount } from '@/domains/chat/infra/chat';

export type AdminChatRow = Awaited<ReturnType<typeof getChats>>[number];

export async function listAdminChatsQuery(input: {
  page: number;
  limit: number;
}) {
  const [rows, total] = await Promise.all([
    getChats({
      page: input.page,
      limit: input.limit,
      getUser: true,
    }),
    getChatsCount({}),
  ]);

  return { rows, total };
}
