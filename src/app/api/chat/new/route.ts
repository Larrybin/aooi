import { generateId } from 'ai';

import { requireUser } from '@/shared/lib/api/guard';
import { parseJson } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { ChatStatus, createChat, type NewChat } from '@/shared/models/chat';
import { ChatNewBodySchema } from '@/shared/schemas/api/chat/new';

export const POST = withApi(async (req: Request) => {
  const { message, body } = await parseJson(req, ChatNewBodySchema);

  const user = await requireUser(req);

  // todo: check user credits

  // todo: get provider from settings
  const provider = 'openrouter';

  // todo: auto generate title
  const title = message.text.substring(0, 100);

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

  return jsonOk(chat);
});
