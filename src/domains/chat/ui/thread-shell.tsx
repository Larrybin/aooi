'use client';

import dynamic from 'next/dynamic';
import type { UIMessage } from 'ai';

import type { Chat } from '@/shared/types/chat';

const ChatBox = dynamic(() => import('./box').then((module) => module.ChatBox), {
  ssr: false,
});

export function ChatThreadShell({
  initialChat,
  initialMessages,
}: {
  initialChat?: Chat;
  initialMessages?: UIMessage[];
}) {
  return (
    <ChatBox initialChat={initialChat} initialMessages={initialMessages} />
  );
}
