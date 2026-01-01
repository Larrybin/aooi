import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { requireOwnedChat } from '@/shared/lib/api/chat';
import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { ChatInfoBodySchema } from '@/shared/schemas/api/chat/info';

export const POST = withApi(async (req: Request) => {
  await requireAiEnabled();

  const api = createApiContext(req);
  const { chatId } = await api.parseJson(ChatInfoBodySchema);
  const user = await api.requireUser();

  const chat = await requireOwnedChat(chatId, user.id);

  return jsonOk(chat, { headers: { 'Cache-Control': 'no-store' } });
});
