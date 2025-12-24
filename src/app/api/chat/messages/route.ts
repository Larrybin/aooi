import { createApiContext } from '@/shared/lib/api/context';
import { ForbiddenError, NotFoundError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse } from '@/shared/lib/json';
import { findChatById } from '@/shared/models/chat';
import {
  getChatMessages,
  getChatMessagesCount,
} from '@/shared/models/chat_message';
import { ChatMessagesBodySchema } from '@/shared/schemas/api/chat/messages';

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { chatId, page, limit } = await api.parseJson(ChatMessagesBodySchema);
  const user = await api.requireUser();

  const chat = await findChatById(chatId);
  if (!chat) {
    throw new NotFoundError('chat not found');
  }

  if (chat.userId !== user.id) {
    throw new ForbiddenError('no permission to access this chat');
  }

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
