import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import type { UIMessage } from 'ai';

import {
  createChatUseCase,
  getChatInfoUseCase,
  listChatMessagesUseCase,
  listChatsUseCase,
  streamChatUseCase,
} from './use-cases';

function createLog() {
  return {
    debugCalls: [] as Array<{ message: string; meta?: unknown }>,
    warnCalls: [] as Array<{ message: string; meta?: unknown }>,
    errorCalls: [] as Array<{ message: string; meta?: unknown }>,
    debug(message: string, meta?: unknown) {
      this.debugCalls.push({ message, meta });
    },
    info() {
      return undefined;
    },
    warn(message: string, meta?: unknown) {
      this.warnCalls.push({ message, meta });
    },
    error(message: string, meta?: unknown) {
      this.errorCalls.push({ message, meta });
    },
  };
}

const AI_SETTINGS_DISABLED: AiRuntimeSettings = {
  aiEnabled: true,
};

const AI_SETTINGS_ENABLED: AiRuntimeSettings = {
  aiEnabled: true,
};

const AI_BINDINGS_DISABLED: AiProviderBindings = {
  openrouterApiKey: '',
  replicateApiToken: '',
  falApiKey: '',
  kieApiKey: '',
};

const AI_BINDINGS_ENABLED: AiProviderBindings = {
  openrouterApiKey: 'key_1',
  replicateApiToken: '',
  falApiKey: '',
  kieApiKey: '',
};

test('createChatUseCase 生成 chat 标题和初始内容', async () => {
  const created: Record<string, unknown>[] = [];

  const result = await createChatUseCase(
    {
      generateId: () => 'chat_1',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      createChat: async (chat) => {
        created.push(chat);
        return chat as never;
      },
    },
    {
      user: { id: 'user_1' },
      message: { text: '  hello world  ' },
      body: { model: 'openai/gpt-5' },
    }
  );

  assert.equal(result.id, 'chat_1');
  assert.equal(created[0]?.provider, 'openrouter');
  assert.equal(created[0]?.title, 'hello world');
});

test('listChatsUseCase 返回分页元信息', async () => {
  const result = await listChatsUseCase(
    {
      getChats: async () => [{ id: 'chat_1', userId: 'user_1' }] as never,
      getChatsCount: async () => 5,
    },
    {
      user: { id: 'user_1' },
      page: 2,
      limit: 2,
    }
  );

  assert.equal(result.total, 5);
  assert.equal(result.hasMore, true);
  assert.equal(result.list.length, 1);
});

test('getChatInfoUseCase 校验 ownership', async () => {
  await assert.rejects(
    () =>
      getChatInfoUseCase(
        {
          findChatById: async () =>
            ({
              id: 'chat_1',
              userId: 'other_user',
            }) as never,
        },
        {
          user: { id: 'user_1' },
          chatId: 'chat_1',
        }
      ),
    /no permission to access this chat/
  );
});

test('listChatMessagesUseCase 对非法 parts 记录日志并 fallback []', async () => {
  const log = createLog();

  const result = await listChatMessagesUseCase(
    {
      findChatById: async () =>
        ({
          id: 'chat_1',
          userId: 'user_1',
        }) as never,
      getChatMessages: async () =>
        [
          {
            id: 'msg_1',
            chatId: 'chat_1',
            userId: 'user_1',
            role: 'assistant',
            parts: '{"bad":true}',
            metadata: '{"foo":"bar"}',
          },
        ] as never,
      getChatMessagesCount: async () => 1,
    },
    {
      user: { id: 'user_1' },
      chatId: 'chat_1',
      page: 1,
      limit: 30,
      log,
    }
  );

  assert.deepEqual(result.list[0]?.parts, []);
  assert.deepEqual(result.list[0]?.metadata, { foo: 'bar' });
  assert.equal(log.errorCalls.length, 1);
});

test('streamChatUseCase 缺 provider key 时不扣 credits 并返回 service unavailable', async () => {
  let consumed = 0;

  await assert.rejects(
    () =>
      streamChatUseCase(
        {
          generateId: () => 'msg_1',
          now: () => new Date(),
          createProvider: () => ({ chat: () => ({}) as never }) as never,
          streamText: () => {
            throw new Error('should not stream');
          },
          convertToModelMessages: () => [],
          findChatById: async () =>
            ({
              id: 'chat_1',
              userId: 'user_1',
            }) as never,
          createChatMessage: async () => {
            throw new Error('should not persist');
          },
          getChatMessageWindow: async () => [],
          readAiRuntimeSettings: async () => AI_SETTINGS_DISABLED,
          readAiProviderBindings: async () => AI_BINDINGS_DISABLED,
          consumeCredits: async () => {
            consumed += 1;
            return { id: 'credit_1' };
          },
          refundConsumedCreditById: async () => ({ refunded: true }),
        },
        {
          user: { id: 'user_1' },
          chatId: 'chat_1',
          message: {
            id: 'u1',
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
          } as UIMessage,
          model: 'openai/gpt-5',
          webSearch: false,
          log: createLog(),
        }
      ),
    /chat service unavailable/
  );

  assert.equal(consumed, 0);
});

test('streamChatUseCase 在 provider failure 时退款', async () => {
  const log = createLog();
  const refunds: string[] = [];
  const persisted: string[] = [];
  let onError: ((error: unknown) => string) | null = null;

  const response = await streamChatUseCase(
    {
      generateId: () => `id_${persisted.length + refunds.length + 1}`,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      createProvider: () =>
        ({ chat: () => ({ provider: 'openrouter' }) as never }) as never,
      streamText: () =>
        ({
          toUIMessageStreamResponse: (options: {
            onError?: (error: unknown) => string;
          }) => {
            onError = options.onError ?? null;
            return new Response('stream');
          },
        }) as never,
      convertToModelMessages: (messages) => messages as never,
      findChatById: async () =>
        ({
          id: 'chat_1',
          userId: 'user_1',
        }) as never,
      createChatMessage: async (message) => {
        persisted.push(message.role);
        return message as never;
      },
      getChatMessageWindow: async () => [],
      readAiRuntimeSettings: async () => AI_SETTINGS_ENABLED,
      readAiProviderBindings: async () => AI_BINDINGS_ENABLED,
      consumeCredits: async () => ({ id: 'credit_1' }),
      refundConsumedCreditById: async (creditId) => {
        refunds.push(creditId);
        return { refunded: true };
      },
    },
    {
      user: { id: 'user_1' },
      chatId: 'chat_1',
      message: {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
      } as UIMessage,
      model: 'openai/gpt-5',
      webSearch: false,
      log,
    }
  );

  assert.equal(
    response.headers.get('content-type'),
    'text/plain;charset=UTF-8'
  );
  assert.deepEqual(persisted, ['user']);

  const handleError = onError as ((error: unknown) => string) | null;
  assert.ok(handleError);
  handleError(new Error('provider failed'));

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(refunds, ['credit_1']);
  assert.equal(log.errorCalls.length > 0, true);
});

test('streamChatUseCase 在 assistant message 持久化失败时退款', async () => {
  const refunds: string[] = [];
  let finish:
    | ((event: {
        messages: UIMessage[];
        finishReason?: string | null;
      }) => Promise<void>)
    | null = null;

  await streamChatUseCase(
    {
      generateId: (() => {
        let counter = 0;
        return () => `id_${++counter}`;
      })(),
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      createProvider: () =>
        ({ chat: () => ({ provider: 'openrouter' }) as never }) as never,
      streamText: () =>
        ({
          toUIMessageStreamResponse: (options: {
            onFinish?: (event: {
              messages: UIMessage[];
              finishReason?: string | null;
            }) => Promise<void>;
          }) => {
            finish = options.onFinish ?? null;
            return new Response('stream');
          },
        }) as never,
      convertToModelMessages: (messages) => messages as never,
      findChatById: async () =>
        ({
          id: 'chat_1',
          userId: 'user_1',
        }) as never,
      createChatMessage: async (message) => {
        if (message.role === 'assistant') {
          throw new Error('persist failed');
        }
        return message as never;
      },
      getChatMessageWindow: async () => [],
      readAiRuntimeSettings: async () => AI_SETTINGS_ENABLED,
      readAiProviderBindings: async () => AI_BINDINGS_ENABLED,
      consumeCredits: async () => ({ id: 'credit_1' }),
      refundConsumedCreditById: async (creditId) => {
        refunds.push(creditId);
        return { refunded: true };
      },
    },
    {
      user: { id: 'user_1' },
      chatId: 'chat_1',
      message: {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
      } as UIMessage,
      model: 'openai/gpt-5',
      webSearch: false,
      log: createLog(),
    }
  );

  const handleFinish = finish as
    | ((event: {
        messages: UIMessage[];
        finishReason?: string | null;
      }) => Promise<void>)
    | null;
  assert.ok(handleFinish);
  await handleFinish({
    finishReason: 'stop',
    messages: [
      {
        id: 'assistant_1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'hi' }],
      } as UIMessage,
    ],
  });

  assert.deepEqual(refunds, ['credit_1']);
});
