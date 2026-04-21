// data: signed-in user (better-auth) + RBAC + chat/messages (db) + redirects
// cache: no-store (request-bound auth/RBAC)
// reason: user-specific chat content; must not cache across users/roles
import { redirect } from 'next/navigation';
import { ChatThreadShell } from '@/domains/chat/ui/thread-shell';
import type { UIMessage } from 'ai';

import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import { safeJsonParse } from '@/shared/lib/json';
import { findChatByIdForViewer } from '@/domains/chat/infra/chat';
import {
  ChatMessageStatus,
  getChatMessages,
} from '@/domains/chat/infra/chat-message';
import type { Chat } from '@/shared/types/chat';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: chatId } = await params;

  const user = await getSignedInUserIdentity();
  if (!user) {
    const callbackUrl = `/chat/${encodeURIComponent(chatId)}`;
    redirect(
      `/${locale}/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
    );
  }

  const chat = await findChatByIdForViewer({
    chatId,
    viewerUserId: user.id,
    allowAccessCondition: accessControlRuntimeDeps.buildPermissionGuardCondition({
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
    <ChatThreadShell
      initialChat={initialChat}
      initialMessages={initialMessages}
    />
  );
}
