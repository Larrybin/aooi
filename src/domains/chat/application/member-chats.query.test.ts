import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listMemberChatsQuery,
  readMemberChatThreadQuery,
} from './member-chats.query';

test('listMemberChatsQuery 返回分页与 total，且不额外加 status 过滤', async () => {
  const calls: unknown[] = [];

  const result = await listMemberChatsQuery(
    {
      userId: 'user_1',
      page: 2,
      limit: 5,
    },
    {
      getChats: async (input) => {
        calls.push(input);
        return [{ id: 'chat_1', userId: 'user_1' }] as never;
      },
      getChatsCount: async (input) => {
        calls.push(input);
        return 1;
      },
    }
  );

  assert.equal(result.total, 1);
  assert.equal(result.rows.length, 1);
  assert.deepEqual(calls, [
    { userId: 'user_1', page: 2, limit: 5 },
    { userId: 'user_1' },
  ]);
});

test('readMemberChatThreadQuery 对越权访问返回 hidden', async () => {
  const result = await readMemberChatThreadQuery(
    {
      chatId: 'chat_1',
      viewerUserId: 'user_1',
      log: createLog(),
    },
    {
      findChatByIdForViewer: async () =>
        ({
          id: 'chat_1',
          userId: 'other_user',
        }) as never,
      getChatMessages: async () => [] as never,
    }
  );

  assert.deepEqual(result, { status: 'hidden' });
});

test('readMemberChatThreadQuery 对非法 parts fallback []', async () => {
  const log = createLog();
  const calls: string[] = [];

  const result = await readMemberChatThreadQuery(
    {
      chatId: 'chat_1',
      viewerUserId: 'user_1',
      log,
    },
    {
      findChatByIdForViewer: async () => {
        calls.push('findChatByIdForViewer');
        return {
          id: 'chat_1',
          userId: 'user_1',
          title: 'Own chat',
        } as never;
      },
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
    }
  );

  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.deepEqual(calls, ['findChatByIdForViewer']);
  assert.deepEqual(result.thread.messages[0]?.parts, []);
  assert.deepEqual(result.thread.messages[0]?.metadata, { foo: 'bar' });
  assert.equal(log.errorCalls.length, 1);
});

// Regression: admin permissions used to swap the owner-scoped lookup for a bare
// findChatById, which let any role holding admin.access read another member's
// private thread even though /api/chat/messages refused the same request. The
// ownership assertion must hold no matter what the lookup hands back.
test('readMemberChatThreadQuery 不因任何权限旁路归属校验', async () => {
  const result = await readMemberChatThreadQuery(
    {
      chatId: 'chat_1',
      viewerUserId: 'user_1',
      log: createLog(),
    },
    {
      findChatByIdForViewer: async () =>
        ({
          id: 'chat_1',
          userId: 'other_user',
          title: 'Someone else chat',
        }) as never,
      getChatMessages: async () => {
        throw new Error('messages must not be read for a non-owned thread');
      },
    }
  );

  assert.deepEqual(result, { status: 'hidden' });
});

function createLog() {
  return {
    errorCalls: [] as Array<{ message: string; meta?: unknown }>,
    debug() {
      return undefined;
    },
    info() {
      return undefined;
    },
    warn() {
      return undefined;
    },
    error(message: string, meta?: unknown) {
      this.errorCalls.push({ message, meta });
    },
  };
}
