import { requireOwnedChat } from '@/shared/lib/api/chat';
import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse, tryJsonParse } from '@/shared/lib/json';
import {
  getChatMessages,
  getChatMessagesCount,
} from '@/shared/models/chat_message';
import { ChatMessagesBodySchema } from '@/shared/schemas/api/chat/messages';

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
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
      parts: (() => {
        const rawParts = message.parts;
        if (typeof rawParts !== 'string') return [];
        if (!rawParts.trim()) return [];

        const parsedParts = tryJsonParse<unknown>(rawParts);
        if (parsedParts.ok && Array.isArray(parsedParts.value)) {
          return parsedParts.value as unknown[];
        }

        log.error('chat: invalid message parts, fallback to []', {
          chatId,
          messageId: message.id,
          partsLength: rawParts.length,
          error: parsedParts.ok ? 'not_array' : parsedParts.error,
        });
        return [];
      })(),
      metadata: safeJsonParse(message.metadata),
    })),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});
