import { isAiEnabledCached } from '@/shared/lib/ai-enabled.server';
import { requireOwnedChat } from '@/shared/lib/api/chat';
import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse } from '@/shared/lib/json';
import { ChatInfoBodySchema } from '@/shared/schemas/api/chat/info';

export const POST = withApi(async (req: Request) => {
  if (!(await isAiEnabledCached())) {
    return new Response('Not Found', { status: 404 });
  }

  const api = createApiContext(req);
  const { chatId } = await api.parseJson(ChatInfoBodySchema);
  const user = await api.requireUser();

  const chat = await requireOwnedChat(chatId, user.id);

  return jsonOk({
    ...chat,
    parts: safeJsonParse(chat.parts) ?? [],
    metadata: safeJsonParse(chat.metadata),
    content: safeJsonParse(chat.content),
  });
});
