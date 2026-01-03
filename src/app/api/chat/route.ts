import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  convertToModelMessages,
  createIdGenerator,
  generateId,
  streamText,
  type UIMessage,
} from 'ai';

import { CHAT_MODEL_CREDIT_COST } from '@/shared/constants/chat-model-policy';
import { CHAT_PROVIDER } from '@/shared/constants/chat-provider';
import { requireAiEnabled } from '@/shared/lib/api/ai-guard';
import { requireOwnedChat } from '@/shared/lib/api/chat';
import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  ForbiddenError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import { setResponseHeader } from '@/shared/lib/api/response-headers';
import { withApi } from '@/shared/lib/api/route';
import { safeJsonParse } from '@/shared/lib/json';
import {
  ChatMessageStatus,
  createChatMessage,
  getChatMessageWindow,
  type NewChatMessage,
} from '@/shared/models/chat_message';
import { getAllConfigs } from '@/shared/models/config';
import { consumeCredits } from '@/shared/models/credit';
import { ChatStreamBodySchema } from '@/shared/schemas/api/chat/stream';

export const POST = withApi(async (req: Request) => {
  await requireAiEnabled();

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

  await requireOwnedChat(chatId, user.id);

  const configs = await getAllConfigs();
  const openrouterApiKey = configs.openrouter_api_key;
  if (!openrouterApiKey) {
    log.error('chat: openrouter_api_key is missing');
    throw new ServiceUnavailableError('chat service unavailable');
  }

  const currentTime = new Date();
  const provider = CHAT_PROVIDER;
  const userMessageId = generateId().toLowerCase();

  const costCredits = CHAT_MODEL_CREDIT_COST[model];
  let creditId: string | null = null;
  if (costCredits > 0) {
    try {
      const consumedCredit = await consumeCredits({
        userId: user.id,
        credits: costCredits,
        scene: 'chat',
        description: 'chat completion',
        metadata: JSON.stringify({
          type: 'chat',
          chatId,
          messageId: userMessageId,
          model,
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

  const metadata = { model, webSearch, reasoning, costCredits, creditId };

  const userMessage: NewChatMessage = {
    id: userMessageId,
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

  const previousMessages = await getChatMessageWindow({
    userId: user.id,
    chatId,
    status: ChatMessageStatus.CREATED,
    limit: 10,
  });

  let validatedMessages: UIMessage[] = [];
  if (previousMessages.length > 0) {
    validatedMessages = previousMessages.map((message) => ({
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

  const response = result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: Boolean(reasoning),
    originalMessages: validatedMessages,
    generateMessageId: createIdGenerator({
      size: 16,
    }),
    onFinish: async ({ messages }) => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const assistantTime = new Date();
        const assistantMessage: NewChatMessage = {
          id: generateId().toLowerCase(),
          chatId,
          userId: user.id,
          status: ChatMessageStatus.CREATED,
          createdAt: assistantTime,
          updatedAt: assistantTime,
          model: model,
          provider: provider,
          parts: JSON.stringify(lastMessage.parts),
          role: 'assistant',
        };
        await createChatMessage(assistantMessage);
      }
    },
  });

  return setResponseHeader(response, 'Cache-Control', 'no-store');
});
