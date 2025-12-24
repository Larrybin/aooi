import { requireOwnedChat } from '@/shared/lib/api/chat';
import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse } from '@/shared/lib/json';
import {
  getChatMessages,
  getChatMessagesCount,
} from '@/shared/models/chat_message';
import { ChatMessagesBodySchema } from '@/shared/schemas/api/chat/messages';

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { chatId, page, limit } = await api.parseJson(ChatMessagesBodySchema);
  const user = await api.requireUser();

  await requireOwnedChat(chatId, user.id);

  const messages = await getChatMessages({
    chatId,
    page,
    limit,
  });
  const total = await getChatMessagesCount({
    chatId,
  });

  return jsonOk({
    list: messages.map((message) => ({
      ...message,
      parts: safeJsonParse(message.parts) ?? [],
      metadata: safeJsonParse(message.metadata),
    })),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});
