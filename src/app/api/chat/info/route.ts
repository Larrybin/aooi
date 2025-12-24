import { createApiContext } from '@/shared/lib/api/context';
import { ForbiddenError, NotFoundError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse } from '@/shared/lib/json';
import { findChatById } from '@/shared/models/chat';
import { ChatInfoBodySchema } from '@/shared/schemas/api/chat/info';

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { chatId } = await api.parseJson(ChatInfoBodySchema);
  const user = await api.requireUser();

  const chat = await findChatById(chatId);
  if (!chat) {
    throw new NotFoundError('chat not found');
  }

  if (chat.userId !== user.id) {
    throw new ForbiddenError('no permission to access this chat');
  }

  return jsonOk({
    ...chat,
    parts: safeJsonParse(chat.parts) ?? [],
    metadata: safeJsonParse(chat.metadata),
    content: safeJsonParse(chat.content),
  });
});
