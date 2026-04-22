import { safeJsonParse, tryJsonParse } from '@/shared/lib/json';

import type {
  Chat,
  findChatById,
  findChatByIdForViewer,
  getChats,
  getChatsCount,
} from '@/domains/chat/infra/chat';
import type { ChatMessage, getChatMessages } from '@/domains/chat/infra/chat-message';

export type MemberChatRow = Awaited<ReturnType<typeof getChats>>[number];

type ChatLog = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

type MemberChatsDeps = {
  getChats: typeof getChats;
  getChatsCount: typeof getChatsCount;
  findChatById: typeof findChatById;
  findChatByIdForViewer: typeof findChatByIdForViewer;
  getChatMessages: typeof getChatMessages;
};

type MemberChatMessageView = {
  id: string;
  role: string;
  parts: unknown[];
  metadata: unknown;
};

export type MemberChatThreadView = {
  chat: Chat;
  messages: MemberChatMessageView[];
};

export async function listMemberChatsQuery(
  input: {
    userId: string;
    page: number;
    limit: number;
  },
  deps?: Pick<MemberChatsDeps, 'getChats' | 'getChatsCount'>
) {
  const resolvedDeps = deps ?? (await getMemberChatsDeps());
  const [rows, total] = await Promise.all([
    resolvedDeps.getChats({
      userId: input.userId,
      page: input.page,
      limit: input.limit,
    }),
    resolvedDeps.getChatsCount({
      userId: input.userId,
    }),
  ]);

  return { rows, total };
}

export async function readMemberChatThreadQuery(
  input: {
    chatId: string;
    viewerUserId: string;
    viewerHasAdminAccess: boolean;
    log: ChatLog;
  },
  deps?: Pick<
    MemberChatsDeps,
    'findChatById' | 'findChatByIdForViewer' | 'getChatMessages'
  >
): Promise<
  | { status: 'hidden' }
  | { status: 'ok'; thread: MemberChatThreadView }
> {
  const resolvedDeps = deps ?? (await getMemberChatsDeps());

  const chat = input.viewerHasAdminAccess
    ? await resolvedDeps.findChatById(input.chatId)
    : await resolvedDeps.findChatByIdForViewer({
        chatId: input.chatId,
        viewerUserId: input.viewerUserId,
      });

  if (!chat) {
    return { status: 'hidden' };
  }

  if (chat.userId !== input.viewerUserId && !input.viewerHasAdminAccess) {
    return { status: 'hidden' };
  }

  const messages = await resolvedDeps.getChatMessages({
    chatId: input.chatId,
    status: 'created' as never,
    page: 1,
    limit: 100,
  });

  return {
    status: 'ok',
    thread: {
      chat,
      messages: messages.map((message) =>
        toMemberChatMessageView(message, input.chatId, input.log)
      ),
    },
  };
}

function toMemberChatMessageView(
  message: ChatMessage,
  chatId: string,
  log: ChatLog
): MemberChatMessageView {
  return {
    id: message.id,
    role: message.role,
    parts: parseMessageParts(message.parts, message.id, chatId, log),
    metadata: safeJsonParse(message.metadata),
  };
}

function parseMessageParts(
  rawParts: string | null | undefined,
  messageId: string,
  chatId: string,
  log: ChatLog
): unknown[] {
  if (typeof rawParts !== 'string') return [];
  if (!rawParts.trim()) return [];

  const parsedParts = tryJsonParse<unknown>(rawParts);
  if (parsedParts.ok && Array.isArray(parsedParts.value)) {
    return parsedParts.value as unknown[];
  }

  log.error('chat: invalid message parts, fallback to []', {
    chatId,
    messageId,
    partsLength: rawParts.length,
    error: parsedParts.ok ? 'not_array' : parsedParts.error,
  });
  return [];
}

async function getMemberChatsDeps(): Promise<MemberChatsDeps> {
  const [chatModule, chatMessageModule] = await Promise.all([
    import('@/domains/chat/infra/chat'),
    import('@/domains/chat/infra/chat-message'),
  ]);

  return {
    getChats: chatModule.getChats,
    getChatsCount: chatModule.getChatsCount,
    findChatById: chatModule.findChatById,
    findChatByIdForViewer: chatModule.findChatByIdForViewer,
    getChatMessages: chatMessageModule.getChatMessages,
  };
}
