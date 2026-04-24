import type { ApiContext } from '@/app/api/_lib/context';
import {
  createChatUseCase,
  getChatInfoUseCase,
  listChatMessagesUseCase,
  listChatsUseCase,
  streamChatUseCase,
} from '@/domains/chat/application/use-cases';
import type { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { convertToModelMessages, streamText, UIMessage } from 'ai';

import { jsonOk } from '@/shared/lib/api/response';
import { setResponseHeader } from '@/shared/lib/api/response-headers';
import {
  ChatInfoBodySchema,
  type ChatInfoBody,
} from '@/shared/schemas/api/chat/info';
import {
  ChatListBodySchema,
  type ChatListBody,
} from '@/shared/schemas/api/chat/list';
import {
  ChatMessagesBodySchema,
  type ChatMessagesBody,
} from '@/shared/schemas/api/chat/messages';
import { ChatNewBodySchema } from '@/shared/schemas/api/chat/new';
import {
  ChatStreamBodySchema,
  type ChatStreamBody,
} from '@/shared/schemas/api/chat/stream';

import type {
  chatInfoDeps,
  chatListDeps,
  chatMessagesDeps,
  chatNewDeps,
  chatStreamDeps,
} from './deps';

export type ChatApiContext = Pick<ApiContext, 'log' | 'requireUser'> & {
  parseJson: ApiContext['parseJson'];
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

export function createChatNewPostAction(deps: ChatHandlerDeps) {
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

export function createChatListPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { page, limit }: ChatListBody =
      await api.parseJson(ChatListBodySchema);
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

export function createChatInfoPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { chatId }: ChatInfoBody = await api.parseJson(ChatInfoBodySchema);
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

export function createChatMessagesPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { log } = api;
    const { chatId, page, limit }: ChatMessagesBody = await api.parseJson(
      ChatMessagesBodySchema
    );
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

export function createChatStreamPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { log } = api;
    const parsed: ChatStreamBody = await api.parseJson(ChatStreamBodySchema);
    const { chatId, message: rawMessage, model, webSearch, reasoning } = parsed;
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
        readAiRuntimeSettings: deps.chatStreamDeps.readAiRuntimeSettings,
        readAiProviderBindings: deps.chatStreamDeps.readAiProviderBindings,
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
