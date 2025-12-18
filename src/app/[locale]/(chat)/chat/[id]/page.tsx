import { redirect } from 'next/navigation';
import type { UIMessage } from 'ai';

import { ChatBox } from '@/shared/blocks/chat/box';
import { safeJsonParse } from '@/shared/lib/json';
import { findChatById } from '@/shared/models/chat';
import { ChatMessageStatus, getChatMessages } from '@/shared/models/chat_message';
import { getUserInfo } from '@/shared/models/user';
import type { Chat } from '@/shared/types/chat';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: chatId } = await params;

  const user = await getUserInfo();
  if (!user) {
    redirect(`/${locale}/sign-in`);
  }

  const chat = await findChatById(chatId);
  if (!chat || chat.userId !== user.id) {
    redirect(`/${locale}/no-permission`);
  }

  const messages = await getChatMessages({
    chatId,
    status: ChatMessageStatus.CREATED,
    page: 1,
    limit: 100,
  });

  const initialChat = {
    id: chat.id,
    title: chat.title ?? '',
    createdAt:
      chat.createdAt instanceof Date
        ? chat.createdAt.toISOString()
        : String(chat.createdAt),
    model: chat.model ?? '',
    provider: chat.provider ?? '',
    parts: safeJsonParse(chat.parts) ?? [],
    metadata: safeJsonParse(chat.metadata),
    content: safeJsonParse(chat.content),
  } as unknown as Chat;

  const initialMessages: UIMessage[] = messages.map((message) => ({
    id: message.id,
    role: message.role as UIMessage['role'],
    parts: safeJsonParse(message.parts) ?? [],
    metadata: safeJsonParse(message.metadata) ?? undefined,
  })) as UIMessage[];

  return <ChatBox initialChat={initialChat} initialMessages={initialMessages} />;
}
