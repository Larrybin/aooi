import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { ChatStatus, getChats, getChatsCount } from '@/shared/models/chat';
import { ChatListBodySchema } from '@/shared/schemas/api/chat/list';

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { page, limit } = await api.parseJson(ChatListBodySchema);
  const user = await api.requireUser();

  const chats = await getChats({
    userId: user.id,
    status: ChatStatus.CREATED,
    page,
    limit,
  });
  const total = await getChatsCount({
    userId: user.id,
    status: ChatStatus.CREATED,
  });

  return jsonOk({
    list: chats,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});
