import { createIdGenerator, type UIMessage } from 'ai';

import {
  CHAT_MODEL_CREDIT_COST,
  type ChatAllowedModel,
} from '@/shared/constants/chat-model-policy';
import { CHAT_PROVIDER } from '@/shared/constants/chat-provider';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import { safeJsonParse, tryJsonParse } from '@/shared/lib/json';

import type {
  ChatApplicationDeps,
  ChatLog,
  ChatMessageRecord,
  ChatRecord,
  ChatUser,
  NewChatMessageRecord,
} from './types';

const CHAT_STATUS_CREATED = 'created';
const CHAT_MESSAGE_STATUS_CREATED = 'created';

type StreamChatDeps = Pick<
  ChatApplicationDeps,
  | 'generateId'
  | 'now'
  | 'createProvider'
  | 'streamText'
  | 'convertToModelMessages'
  | 'findChatById'
  | 'createChatMessage'
  | 'getChatMessageWindow'
  | 'getAllConfigs'
  | 'consumeCredits'
  | 'refundConsumedCreditById'
>;

export type CreateChatInput = {
  user: ChatUser;
  message: { text: string };
  body: { model: ChatAllowedModel };
};

export type ListChatsInput = {
  user: ChatUser;
  page: number;
  limit: number;
};

export type GetChatInfoInput = {
  user: ChatUser;
  chatId: string;
};

export type ListChatMessagesInput = {
  user: ChatUser;
  chatId: string;
  page: number;
  limit: number;
  log: ChatLog;
};

export type StreamChatInput = {
  user: ChatUser;
  chatId: string;
  message: UIMessage;
  model: ChatAllowedModel;
  webSearch: boolean;
  reasoning?: boolean;
  log: ChatLog;
};

export type ChatListResult = {
  list: ChatRecord[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type ChatMessagesResult = {
  list: Array<
    ChatMessageRecord & {
      parts: unknown[];
      metadata: unknown;
    }
  >;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export async function requireOwnedChat(
  deps: Pick<ChatApplicationDeps, 'findChatById'>,
  chatId: string,
  userId: string
): Promise<ChatRecord> {
  const chat = await deps.findChatById(chatId);
  if (!chat) {
    throw new NotFoundError('chat not found');
  }

  if (chat.userId !== userId) {
    throw new ForbiddenError('no permission to access this chat');
  }

  return chat;
}

export async function createChatUseCase(
  deps: Pick<ChatApplicationDeps, 'generateId' | 'now' | 'createChat'>,
  input: CreateChatInput
) {
  const currentTime = deps.now();
  const chatId = deps.generateId().toLowerCase();
  const title = (input.message.text.trim() || input.message.text).substring(
    0,
    100
  );
  const parts = [
    {
      type: 'text',
      text: input.message.text,
    },
  ];

  return deps.createChat({
    id: chatId,
    userId: input.user.id,
    status: CHAT_STATUS_CREATED,
    createdAt: currentTime,
    updatedAt: currentTime,
    model: input.body.model,
    provider: CHAT_PROVIDER,
    title,
    parts: JSON.stringify(parts),
    metadata: JSON.stringify(input.body),
    content: JSON.stringify(input.message),
  });
}

export async function listChatsUseCase(
  deps: Pick<ChatApplicationDeps, 'getChats' | 'getChatsCount'>,
  input: ListChatsInput
): Promise<ChatListResult> {
  const list = await deps.getChats({
    userId: input.user.id,
    status: CHAT_STATUS_CREATED,
    page: input.page,
    limit: input.limit,
  });
  const total = await deps.getChatsCount({
    userId: input.user.id,
    status: CHAT_STATUS_CREATED,
  });

  return {
    list,
    total,
    page: input.page,
    limit: input.limit,
    hasMore: input.page * input.limit < total,
  };
}

export async function getChatInfoUseCase(
  deps: Pick<ChatApplicationDeps, 'findChatById'>,
  input: GetChatInfoInput
) {
  return requireOwnedChat(deps, input.chatId, input.user.id);
}

export async function listChatMessagesUseCase(
  deps: Pick<
    ChatApplicationDeps,
    'findChatById' | 'getChatMessages' | 'getChatMessagesCount'
  >,
  input: ListChatMessagesInput
): Promise<ChatMessagesResult> {
  await requireOwnedChat(deps, input.chatId, input.user.id);

  const messages = await deps.getChatMessages({
    chatId: input.chatId,
    page: input.page,
    limit: input.limit,
  });
  const total = await deps.getChatMessagesCount({ chatId: input.chatId });

  return {
    list: messages.map((message) => ({
      ...message,
      parts: parseMessageParts(message, input.chatId, input.log),
      metadata: safeJsonParse(message.metadata),
    })),
    total,
    page: input.page,
    limit: input.limit,
    hasMore: input.page * input.limit < total,
  };
}

function parseMessageParts(
  message: ChatMessageRecord,
  chatId: string,
  log: ChatLog
): unknown[] {
  const rawParts = message.parts;
  if (typeof rawParts !== 'string') return [];
  if (!rawParts.trim()) return [];

  const parsedParts = tryJsonParse<unknown>(rawParts);
  if (parsedParts.ok && Array.isArray(parsedParts.value)) {
    return parsedParts.value as unknown[];
  }

  log.error('chat: invalid message parts, fallback to []', {
    chatId,
    messageId: message.id,
    partsLength: rawParts.length,
    error: parsedParts.ok ? 'not_array' : parsedParts.error,
  });
  return [];
}

export async function streamChatUseCase(
  deps: StreamChatDeps,
  input: StreamChatInput
): Promise<Response> {
  if (
    !input.message ||
    !Array.isArray(input.message.parts) ||
    input.message.parts.length === 0
  ) {
    throw new BadRequestError('invalid message');
  }

  await requireOwnedChat(deps, input.chatId, input.user.id);

  const configs = await deps.getAllConfigs();
  const openrouterApiKey = configs.openrouter_api_key;
  if (!openrouterApiKey) {
    input.log.error('chat: openrouter_api_key is missing');
    throw new ServiceUnavailableError('chat service unavailable');
  }

  const currentTime = deps.now();
  const userMessageId = deps.generateId().toLowerCase();
  const costCredits = CHAT_MODEL_CREDIT_COST[input.model];
  let creditId: string | null = null;

  if (costCredits > 0) {
    try {
      const consumedCredit = await deps.consumeCredits({
        userId: input.user.id,
        credits: costCredits,
        scene: 'chat',
        description: 'chat completion',
        metadata: JSON.stringify({
          type: 'chat',
          chatId: input.chatId,
          messageId: userMessageId,
          model: input.model,
        }),
      });
      creditId = consumedCredit.id;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.startsWith('Insufficient credits')
      ) {
        throw new ForbiddenError('insufficient credits');
      }
      throw error;
    }
  }

  async function refundCredits(
    reason: string,
    extra?: Record<string, unknown>
  ) {
    if (!creditId) return;
    try {
      const result = await deps.refundConsumedCreditById(creditId);
      if (result.refunded) {
        input.log.warn('chat: credits refunded', {
          reason,
          chatId: input.chatId,
          userId: input.user.id,
          messageId: userMessageId,
          model: input.model,
          costCredits,
          creditId,
          ...extra,
        });
      } else {
        input.log.debug('chat: credits refund skipped', {
          reason,
          refundSkipReason: result.reason,
          chatId: input.chatId,
          userId: input.user.id,
          messageId: userMessageId,
          model: input.model,
          costCredits,
          creditId,
          ...extra,
        });
      }
    } catch (error: unknown) {
      input.log.error('chat: credits refund failed', {
        reason,
        chatId: input.chatId,
        userId: input.user.id,
        messageId: userMessageId,
        model: input.model,
        costCredits,
        creditId,
        error,
        ...extra,
      });
    }
  }

  try {
    const metadata = {
      model: input.model,
      webSearch: input.webSearch,
      reasoning: input.reasoning,
      costCredits,
      creditId,
    };

    await deps.createChatMessage({
      id: userMessageId,
      chatId: input.chatId,
      userId: input.user.id,
      status: CHAT_MESSAGE_STATUS_CREATED,
      createdAt: currentTime,
      updatedAt: currentTime,
      role: 'user',
      parts: JSON.stringify(input.message.parts),
      metadata: JSON.stringify(metadata),
      model: input.model,
      provider: CHAT_PROVIDER,
    });

    const provider = deps.createProvider({ apiKey: openrouterApiKey });
    const previousMessages = await deps.getChatMessageWindow({
      userId: input.user.id,
      chatId: input.chatId,
      status: CHAT_MESSAGE_STATUS_CREATED,
      limit: 10,
    });
    const validatedMessages = previousMessages.map(toUiMessage);

    const result = deps.streamText({
      model: provider.chat(input.model),
      messages: deps.convertToModelMessages(validatedMessages),
    });

    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: Boolean(input.reasoning),
      originalMessages: validatedMessages,
      generateMessageId: createIdGenerator({ size: 16 }),
      onError: (error: unknown) => {
        input.log.error('chat: stream error', {
          chatId: input.chatId,
          userId: input.user.id,
          messageId: userMessageId,
          model: input.model,
          costCredits,
          creditId,
          error,
        });
        void refundCredits('stream_error');
        return 'An error occurred.';
      },
      onFinish: async ({ messages, finishReason }) => {
        if (finishReason === 'error') {
          await refundCredits('finish_reason_error', { finishReason });
          return;
        }

        const lastMessage = messages[messages.length - 1];
        let assistantPersisted = false;

        if (lastMessage?.role === 'assistant') {
          try {
            await deps.createChatMessage(
              buildAssistantMessage({
                input,
                currentTime: deps.now(),
                messageId: deps.generateId().toLowerCase(),
                lastMessage,
              })
            );
            assistantPersisted = true;
          } catch (error: unknown) {
            input.log.error('chat: persist assistant message failed', {
              chatId: input.chatId,
              userId: input.user.id,
              messageId: userMessageId,
              model: input.model,
              costCredits,
              creditId,
              error,
            });
          }
        }

        if (finishReason && !assistantPersisted) {
          await refundCredits('missing_assistant_message', { finishReason });
        }
      },
    });
  } catch (error: unknown) {
    await refundCredits('route_error', { error });
    throw error;
  }
}

function toUiMessage(message: ChatMessageRecord): UIMessage {
  const parsed = safeJsonParse<unknown>(message.parts);
  return {
    id: message.id,
    role: message.role,
    parts: Array.isArray(parsed) ? (parsed as UIMessage['parts']) : [],
  };
}

function buildAssistantMessage({
  input,
  currentTime,
  messageId,
  lastMessage,
}: {
  input: StreamChatInput;
  currentTime: Date;
  messageId: string;
  lastMessage: UIMessage;
}): NewChatMessageRecord {
  return {
    id: messageId,
    chatId: input.chatId,
    userId: input.user.id,
    status: CHAT_MESSAGE_STATUS_CREATED,
    createdAt: currentTime,
    updatedAt: currentTime,
    model: input.model,
    provider: CHAT_PROVIDER,
    parts: JSON.stringify(lastMessage.parts),
    role: 'assistant',
  };
}
