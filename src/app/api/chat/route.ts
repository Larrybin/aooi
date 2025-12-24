import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  convertToModelMessages,
  createIdGenerator,
  generateId,
  streamText,
  type UIMessage,
} from 'ai';

import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse } from '@/shared/lib/json';
import { findChatById } from '@/shared/models/chat';
import {
  ChatMessageStatus,
  createChatMessage,
  getChatMessages,
  type NewChatMessage,
} from '@/shared/models/chat_message';
import { getAllConfigs } from '@/shared/models/config';
import { ChatStreamBodySchema } from '@/shared/schemas/api/chat/stream';

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
  const {
    chatId,
    message: rawMessage,
    model,
    webSearch,
    reasoning,
  } = await api.parseJson(ChatStreamBodySchema);

  const message = rawMessage as UIMessage;
  if (!message || !Array.isArray(message.parts) || message.parts.length === 0) {
    throw new BadRequestError('invalid message');
  }

  const user = await api.requireUser();

  const chat = await findChatById(chatId);
  if (!chat) {
    throw new NotFoundError('chat not found');
  }

  if (chat.userId !== user.id) {
    throw new ForbiddenError('no permission to access this chat');
  }

  const configs = await getAllConfigs();
  const openrouterApiKey = configs.openrouter_api_key;
  if (!openrouterApiKey) {
    log.error('chat: openrouter_api_key is missing');
    throw new ServiceUnavailableError('chat service unavailable');
  }

  const currentTime = new Date();
  const metadata = { model, webSearch, reasoning };
  const provider = 'openrouter';

  const userMessage: NewChatMessage = {
    id: generateId().toLowerCase(),
    chatId,
    userId: user.id,
    status: ChatMessageStatus.CREATED,
    createdAt: currentTime,
    updatedAt: currentTime,
    role: 'user',
    parts: JSON.stringify(message.parts),
    metadata: JSON.stringify(metadata),
    model: model,
    provider: provider,
  };
  await createChatMessage(userMessage);

  const openrouter = createOpenRouter({ apiKey: openrouterApiKey });

  const previousMessages = await getChatMessages({
    chatId,
    status: ChatMessageStatus.CREATED,
    page: 1,
    limit: 10,
  });

  let validatedMessages: UIMessage[] = [];
  if (previousMessages.length > 0) {
    validatedMessages = previousMessages.reverse().map((message) => ({
      id: message.id,
      role: message.role,
      parts: (() => {
        const parsed = safeJsonParse<unknown>(message.parts);
        return Array.isArray(parsed) ? (parsed as unknown[]) : [];
      })(),
    })) as UIMessage[];
  }

  const result = streamText({
    model: openrouter.chat(model),
    messages: convertToModelMessages(validatedMessages),
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: Boolean(reasoning),
    originalMessages: validatedMessages,
    generateMessageId: createIdGenerator({
      size: 16,
    }),
    onFinish: async ({ messages }) => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const assistantMessage: NewChatMessage = {
          id: generateId().toLowerCase(),
          chatId,
          userId: user.id,
          status: ChatMessageStatus.CREATED,
          createdAt: currentTime,
          updatedAt: currentTime,
          model: model,
          provider: provider,
          parts: JSON.stringify(lastMessage.parts),
          role: 'assistant',
        };
        await createChatMessage(assistantMessage);
      }
    },
  });
});
