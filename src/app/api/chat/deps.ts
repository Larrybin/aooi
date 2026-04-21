import {
  createChat,
  ChatStatus,
  findChatById,
  getChats,
  getChatsCount,
} from '@/shared/models/chat';
import {
  createChatMessage,
  ChatMessageStatus,
  getChatMessageWindow,
  getChatMessages,
  getChatMessagesCount,
} from '@/shared/models/chat_message';
import { readRuntimeSettingsCached } from '@/domains/settings/application/settings-store';
import {
  consumeCredits,
  refundConsumedCreditById,
} from '@/shared/models/credit';
import type {
  ChatMessageRecord,
  ChatRecord,
  ChatStatus as DomainChatStatus,
  ChatMessageStatus as DomainChatMessageStatus,
  NewChatMessageRecord,
  NewChatRecord,
} from '@/domains/chat/application/types';

function toChatStatus(status: DomainChatStatus): ChatStatus {
  switch (status) {
    case 'pending':
      return ChatStatus.PENDING;
    case 'created':
      return ChatStatus.CREATED;
    case 'deleted':
      return ChatStatus.DELETED;
  }
}

function toChatMessageStatus(
  status: DomainChatMessageStatus
): ChatMessageStatus {
  switch (status) {
    case 'created':
      return ChatMessageStatus.CREATED;
    case 'deleted':
      return ChatMessageStatus.DELETED;
  }
}

function mapChatRecord(record: Awaited<ReturnType<typeof findChatById>>): ChatRecord | undefined {
  if (!record) {
    return undefined;
  }

  const status: DomainChatStatus | null =
    record.status === ChatStatus.PENDING
      ? 'pending'
      : record.status === ChatStatus.CREATED
        ? 'created'
        : record.status === ChatStatus.DELETED
          ? 'deleted'
          : null;

  return {
    id: record.id,
    userId: record.userId,
    status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    model: record.model,
    provider: record.provider,
    title: record.title,
    parts: record.parts,
    metadata: record.metadata,
    content: record.content,
  };
}

function mapChatMessageRecord(
  record: Awaited<ReturnType<typeof getChatMessages>>[number]
): ChatMessageRecord {
  const status: DomainChatMessageStatus | null =
    record.status === ChatMessageStatus.CREATED
      ? 'created'
      : record.status === ChatMessageStatus.DELETED
        ? 'deleted'
        : null;

  return {
    id: record.id,
    chatId: record.chatId,
    userId: record.userId,
    status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    role: record.role,
    parts: record.parts,
    metadata: record.metadata,
    model: record.model,
    provider: record.provider,
  };
}

export const chatNewDeps = {
  createChat: async (record: NewChatRecord) =>
    mapChatRecord(
      await createChat({
        id: record.id,
        userId: record.userId,
        status: toChatStatus(record.status),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        model: record.model,
        provider: record.provider,
        title: record.title ?? undefined,
        parts: record.parts ?? '',
        metadata: record.metadata ?? null,
        content: record.content ?? null,
      })
    ) as ChatRecord,
};

export const chatListDeps = {
  getChats: async ({
    userId,
    status,
    page,
    limit,
  }: {
    userId: string;
    status: DomainChatStatus;
    page: number;
    limit: number;
  }) =>
    (
      await getChats({
        userId,
        status: toChatStatus(status),
        page,
        limit,
      })
    ).map((record) => mapChatRecord(record) as ChatRecord),
  getChatsCount: ({
    userId,
    status,
  }: {
    userId: string;
    status: DomainChatStatus;
  }) =>
    getChatsCount({
      userId,
      status: toChatStatus(status),
    }),
};

export const chatInfoDeps = {
  findChatById: async (id: string) => mapChatRecord(await findChatById(id)),
};

export const chatMessagesDeps = {
  findChatById: async (id: string) => mapChatRecord(await findChatById(id)),
  getChatMessages: async ({
    chatId,
    page,
    limit,
  }: {
    chatId: string;
    page: number;
    limit: number;
  }) =>
    (
      await getChatMessages({
        chatId,
        page,
        limit,
      })
    ).map(mapChatMessageRecord),
  getChatMessagesCount: ({ chatId }: { chatId: string }) =>
    getChatMessagesCount({ chatId }),
};

export const chatStreamDeps = {
  findChatById: async (id: string) => mapChatRecord(await findChatById(id)),
  createChatMessage: async (record: NewChatMessageRecord) =>
    mapChatMessageRecord(
      await createChatMessage({
        ...record,
        status: toChatMessageStatus(record.status),
      })
    ),
  getChatMessageWindow: async ({
    userId,
    chatId,
    status,
    limit,
  }: {
    userId: string;
    chatId: string;
    status: DomainChatMessageStatus;
    limit: number;
  }) =>
    (
      await getChatMessageWindow({
        userId,
        chatId,
        status: toChatMessageStatus(status),
        limit,
      })
    ).map(mapChatMessageRecord),
  readRuntimeSettings: readRuntimeSettingsCached,
  consumeCredits,
  refundConsumedCreditById,
};
