import { ChatInfoBodySchema } from '@/features/web/chat/schemas/info';
import { requireOwnedChat } from '@/features/web/chat/server/guard';

import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

export const POST = withApi(async (req: Request) => {
  await requireAiEnabled();

  const api = createApiContext(req);
  const { chatId } = await api.parseJson(ChatInfoBodySchema);
  const user = await api.requireUser();

  const chat = await requireOwnedChat(chatId, user.id);

  return jsonOk(chat, { headers: { 'Cache-Control': 'no-store' } });
});
