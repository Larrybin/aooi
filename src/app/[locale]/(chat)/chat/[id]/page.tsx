import { redirect } from 'next/navigation';
import type { UIMessage } from 'ai';

import { ChatBox } from '@/shared/blocks/chat/box';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { safeJsonParse } from '@/shared/lib/json';
import { findChatByIdForViewer } from '@/shared/models/chat';
import {
  ChatMessageStatus,
  getChatMessages,
} from '@/shared/models/chat_message';
import { getUserInfo } from '@/shared/models/user';
import { buildHasPermissionCondition } from '@/shared/services/rbac';
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

  const chat = await findChatByIdForViewer({
    chatId,
    viewerUserId: user.id,
    allowAccessCondition: buildHasPermissionCondition({
      userId: user.id,
      permissionCode: PERMISSIONS.ADMIN_ACCESS,
    }),
  });
  if (!chat) {
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
    parts: chat.parts ?? '[]',
    metadata: chat.metadata ?? null,
    content: chat.content ?? null,
  } satisfies Chat;

  const initialMessages: UIMessage[] = messages.map((message) => ({
    id: message.id,
    role: message.role as UIMessage['role'],
    parts: safeJsonParse(message.parts) ?? [],
    metadata: safeJsonParse(message.metadata) ?? undefined,
  })) as UIMessage[];

  return (
    <ChatBox initialChat={initialChat} initialMessages={initialMessages} />
  );
}
