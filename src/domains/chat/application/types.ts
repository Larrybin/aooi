import type {
  convertToModelMessages,
  streamText,
} from 'ai';
import type { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';

export type ChatUser = {
  id: string;
};

export type ChatLog = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

export const CHAT_STATUS = {
  PENDING: 'pending',
  CREATED: 'created',
  DELETED: 'deleted',
} as const;

export type ChatStatus = (typeof CHAT_STATUS)[keyof typeof CHAT_STATUS];

export const CHAT_MESSAGE_STATUS = {
  CREATED: 'created',
  DELETED: 'deleted',
} as const;

export type ChatMessageStatus =
  (typeof CHAT_MESSAGE_STATUS)[keyof typeof CHAT_MESSAGE_STATUS];

export type ChatRecord = {
  id: string;
  userId: string;
  status?: ChatStatus | null;
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
  status?: ChatMessageStatus | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  role: string;
  parts?: string | null;
  metadata?: string | null;
  model?: string | null;
  provider?: string | null;
};

export type NewChatRecord = {
  id: string;
  userId: string;
  status: ChatStatus;
  createdAt: Date;
  updatedAt: Date;
  model: string;
  provider: string;
  title?: string | null;
  parts?: string | null;
  metadata?: string | null;
  content?: string | null;
};

export type NewChatMessageRecord = {
  id: string;
  chatId: string;
  userId: string;
  status: ChatMessageStatus;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  parts: string;
  metadata?: string | null;
  model: string;
  provider: string;
};

export type RefundConsumedCreditResult =
  | { refunded: true }
  | { refunded: false; reason: string };

export type ChatApplicationDeps = {
  generateId: () => string;
  now: () => Date;
  createProvider: typeof createOpenRouter;
  streamText: typeof streamText;
  convertToModelMessages: typeof convertToModelMessages;
  findChatById: (id: string) => Promise<ChatRecord | undefined>;
  createChat: (chat: NewChatRecord) => Promise<ChatRecord>;
  getChats: (params: {
    userId: string;
    status: ChatStatus;
    page: number;
    limit: number;
  }) => Promise<ChatRecord[]>;
  getChatsCount: (params: {
    userId: string;
    status: ChatStatus;
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
    status: ChatMessageStatus;
    limit: number;
  }) => Promise<ChatMessageRecord[]>;
  readAiRuntimeSettings: () => Promise<AiRuntimeSettings>;
  readAiProviderBindings: () => Promise<AiProviderBindings>;
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
