import type { UIMessage } from 'ai';

import type { ChatAllowedModel } from '@/shared/constants/chat-model-policy';

export type ChatUser = {
  id: string;
};

export type ChatLog = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

export type ChatRecord = {
  id: string;
  userId: string;
  status?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  model?: string | null;
  provider?: string | null;
  title?: string | null;
  parts?: string | null;
  metadata?: string | null;
  content?: string | null;
};

export type ChatMessageRecord = {
  id: string;
  chatId: string;
  userId: string;
  status?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  role: 'system' | 'user' | 'assistant';
  parts?: string | null;
  metadata?: string | null;
  model?: string | null;
  provider?: string | null;
};

export type NewChatRecord = Omit<ChatRecord, 'status'> & {
  status: string;
};

export type NewChatMessageRecord = Omit<ChatMessageRecord, 'status'> & {
  status: string;
};

export type RefundConsumedCreditResult =
  | { refunded: true }
  | { refunded: false; reason: string };

export type ChatConfigs = Record<string, string>;

export type ChatStream = {
  toUIMessageStreamResponse: (options: {
    sendSources: boolean;
    sendReasoning: boolean;
    originalMessages: UIMessage[];
    generateMessageId: () => string;
    onError: (error: unknown) => string;
    onFinish: (event: {
      messages: UIMessage[];
      finishReason?: string | null;
    }) => Promise<void>;
  }) => Response;
};

export type ChatModelProvider = {
  chat: (model: ChatAllowedModel) => unknown;
};

export type ChatApplicationDeps = {
  generateId: () => string;
  now: () => Date;
  createProvider: (params: { apiKey: string }) => ChatModelProvider;
  streamText: (params: { model: unknown; messages: unknown[] }) => ChatStream;
  convertToModelMessages: (messages: UIMessage[]) => unknown[];
  findChatById: (id: string) => Promise<ChatRecord | undefined>;
  createChat: (chat: NewChatRecord) => Promise<ChatRecord>;
  getChats: (params: {
    userId: string;
    status: string;
    page: number;
    limit: number;
  }) => Promise<ChatRecord[]>;
  getChatsCount: (params: {
    userId: string;
    status: string;
  }) => Promise<number>;
  createChatMessage: (
    message: NewChatMessageRecord
  ) => Promise<ChatMessageRecord>;
  getChatMessages: (params: {
    chatId: string;
    page: number;
    limit: number;
  }) => Promise<ChatMessageRecord[]>;
  getChatMessagesCount: (params: { chatId: string }) => Promise<number>;
  getChatMessageWindow: (params: {
    userId: string;
    chatId: string;
    status: string;
    limit: number;
  }) => Promise<ChatMessageRecord[]>;
  getAllConfigs: () => Promise<ChatConfigs>;
  consumeCredits: (params: {
    userId: string;
    credits: number;
    scene: string;
    description: string;
    metadata: string;
  }) => Promise<{ id: string }>;
  refundConsumedCreditById: (
    creditId: string
  ) => Promise<RefundConsumedCreditResult>;
};
