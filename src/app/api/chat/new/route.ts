import { generateId } from 'ai';

import { CHAT_PROVIDER } from '@/shared/constants/chat-provider';
import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { ChatStatus, createChat, type NewChat } from '@/shared/models/chat';
import { ChatNewBodySchema } from '@/shared/schemas/api/chat/new';

export const POST = withApi(async (req: Request) => {
  await requireAiEnabled();

  const api = createApiContext(req);
  const { message, body } = await api.parseJson(ChatNewBodySchema);
  const user = await api.requireUser();

  const provider = CHAT_PROVIDER;

  const title = (message.text.trim() || message.text).substring(0, 100);

  const chatId = generateId().toLowerCase();
  const currentTime = new Date();

  const parts = [
    {
      type: 'text',
      text: message.text,
    },
  ];

  const chat: NewChat = {
    id: chatId,
    userId: user.id,
    status: ChatStatus.CREATED,
    createdAt: currentTime,
    updatedAt: currentTime,
    model: body.model,
    provider: provider,
    title: title,
    parts: JSON.stringify(parts),
    metadata: JSON.stringify(body),
    content: JSON.stringify(message),
  };

  await createChat(chat);

  return jsonOk(chat, { headers: { 'Cache-Control': 'no-store' } });
});
