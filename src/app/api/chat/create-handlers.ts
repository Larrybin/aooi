import type { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { UIMessage, convertToModelMessages, streamText } from 'ai';

import {
  createChatUseCase,
  getChatInfoUseCase,
  listChatMessagesUseCase,
  listChatsUseCase,
  streamChatUseCase,
} from '@/domains/chat/application/use-cases';
import type { ApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { setResponseHeader } from '@/shared/lib/api/response-headers';
import { ChatInfoBodySchema } from '@/shared/schemas/api/chat/info';
import type { ChatInfoBody } from '@/shared/schemas/api/chat/info';
import { ChatListBodySchema } from '@/shared/schemas/api/chat/list';
import type { ChatListBody } from '@/shared/schemas/api/chat/list';
import { ChatMessagesBodySchema } from '@/shared/schemas/api/chat/messages';
import type { ChatMessagesBody } from '@/shared/schemas/api/chat/messages';
import { ChatNewBodySchema } from '@/shared/schemas/api/chat/new';
import type { ChatNewBody } from '@/shared/schemas/api/chat/new';
import { ChatStreamBodySchema } from '@/shared/schemas/api/chat/stream';
import type { ChatStreamBody } from '@/shared/schemas/api/chat/stream';

import type {
  chatInfoDeps,
  chatListDeps,
  chatMessagesDeps,
  chatNewDeps,
  chatStreamDeps,
} from './deps';

export type ChatApiContext = Pick<ApiContext, 'log' | 'requireUser'> & {
  parseJson: {
    (schema: typeof ChatNewBodySchema): Promise<ChatNewBody>;
    (schema: typeof ChatListBodySchema): Promise<ChatListBody>;
    (schema: typeof ChatInfoBodySchema): Promise<ChatInfoBody>;
    (schema: typeof ChatMessagesBodySchema): Promise<ChatMessagesBody>;
    (schema: typeof ChatStreamBodySchema): Promise<ChatStreamBody>;
  };
};

export type ChatHandlerDeps = {
  requireAiEnabled: () => Promise<void>;
  createApiContext: (request: Request) => ChatApiContext;
  generateId: () => string;
  now: () => Date;
  createProvider: typeof createOpenRouter;
  streamText: typeof streamText;
  convertToModelMessages: typeof convertToModelMessages;
  chatNewDeps: typeof chatNewDeps;
  chatListDeps: typeof chatListDeps;
  chatInfoDeps: typeof chatInfoDeps;
  chatMessagesDeps: typeof chatMessagesDeps;
  chatStreamDeps: typeof chatStreamDeps;
};

export function createChatNewPostAction(
  deps: ChatHandlerDeps
) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { message, body } = await api.parseJson(ChatNewBodySchema);
    const user = await api.requireUser();

    const chat = await createChatUseCase(
      {
        generateId: deps.generateId,
        now: deps.now,
        createChat: deps.chatNewDeps.createChat,
      },
      {
        user,
        message,
        body,
      }
    );

    return jsonOk(chat, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createChatListPostAction(
  deps: ChatHandlerDeps
) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { page, limit } = await api.parseJson(ChatListBodySchema);
    const user = await api.requireUser();

    const result = await listChatsUseCase(
      {
        getChats: deps.chatListDeps.getChats,
        getChatsCount: deps.chatListDeps.getChatsCount,
      },
      {
        user,
        page,
        limit,
      }
    );

    return jsonOk(result, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createChatInfoPostAction(
  deps: ChatHandlerDeps
) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { chatId } = await api.parseJson(ChatInfoBodySchema);
    const user = await api.requireUser();

    const chat = await getChatInfoUseCase(
      {
        findChatById: deps.chatInfoDeps.findChatById,
      },
      {
        chatId,
        user,
      }
    );

    return jsonOk(chat, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createChatMessagesPostAction(
  deps: ChatHandlerDeps
) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { log } = api;
    const { chatId, page, limit } = await api.parseJson(ChatMessagesBodySchema);
    const user = await api.requireUser();

    const result = await listChatMessagesUseCase(
      {
        findChatById: deps.chatMessagesDeps.findChatById,
        getChatMessages: deps.chatMessagesDeps.getChatMessages,
        getChatMessagesCount: deps.chatMessagesDeps.getChatMessagesCount,
      },
      {
        user,
        chatId,
        page,
        limit,
        log,
      }
    );

    return jsonOk(result, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createChatStreamPostAction(
  deps: ChatHandlerDeps
) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { log } = api;
    const {
      chatId,
      message: rawMessage,
      model,
      webSearch,
      reasoning,
    } = await api.parseJson(ChatStreamBodySchema);
    const user = await api.requireUser();

    const response = await streamChatUseCase(
      {
        generateId: deps.generateId,
        now: deps.now,
        createProvider: deps.createProvider,
        streamText: deps.streamText,
        convertToModelMessages: deps.convertToModelMessages,
        findChatById: deps.chatStreamDeps.findChatById,
        createChatMessage: deps.chatStreamDeps.createChatMessage,
        getChatMessageWindow: deps.chatStreamDeps.getChatMessageWindow,
        getAllConfigs: deps.chatStreamDeps.getAllConfigs,
        consumeCredits: deps.chatStreamDeps.consumeCredits,
        refundConsumedCreditById: deps.chatStreamDeps.refundConsumedCreditById,
      },
      {
        user,
        chatId,
        message: rawMessage as UIMessage,
        model,
        webSearch,
        reasoning,
        log,
      }
    );

    return setResponseHeader(response, 'Cache-Control', 'no-store');
  };
}
