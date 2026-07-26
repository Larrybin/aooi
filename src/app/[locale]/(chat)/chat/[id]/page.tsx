// data: signed-in user (better-auth) + RBAC + chat/messages (db) + redirects
// cache: no-store (request-bound auth/RBAC)
// reason: user-specific chat content; must not cache across users/roles
import { redirect } from 'next/navigation';
import { readMemberChatThreadQuery } from '@/domains/chat/application/member-chats.query';
import { ChatThreadShell } from '@/domains/chat/ui/thread-shell';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import type { UIMessage } from 'ai';

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

  // owner-only, mirroring /api/chat/messages: no admin permission grants access to
  // another member's private thread, so the page and the API cannot disagree.
  const chatResult = await readMemberChatThreadQuery({
    chatId,
    viewerUserId: user.id,
    log: createUseCaseLogger({
      domain: 'chat',
      useCase: 'member-chat-thread',
      operation: 'page-load',
    }),
  });
  if (chatResult.status !== 'ok') {
    redirect(`/${locale}/no-permission`);
  }
  const { chat, messages } = chatResult.thread;

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
    parts: message.parts,
    metadata: message.metadata ?? undefined,
  })) as UIMessage[];

  return (
    <ChatThreadShell
      initialChat={initialChat}
      initialMessages={initialMessages}
    />
  );
}
