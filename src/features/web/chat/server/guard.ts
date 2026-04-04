import 'server-only';

import { ForbiddenError, NotFoundError } from '@/shared/lib/api/errors';
import { findChatById, type Chat } from '@/shared/models/chat';

export async function requireOwnedChat(
  chatId: string,
  userId: string
): Promise<Chat> {
  const chat = await findChatById(chatId);
  if (!chat) {
    throw new NotFoundError('chat not found');
  }

  if (chat.userId !== userId) {
    throw new ForbiddenError('no permission to access this chat');
  }

  return chat;
}
