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
      viewerHasAdminAccess: false,
      log: createLog(),
    },
    {
      findChatById: async () => {
        throw new Error('should not read chat by id for non-admin');
      },
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

test('readMemberChatThreadQuery 允许管理员旁路，且非法 parts fallback []', async () => {
  const log = createLog();
  const calls: string[] = [];

  const result = await readMemberChatThreadQuery(
    {
      chatId: 'chat_1',
      viewerUserId: 'user_1',
      viewerHasAdminAccess: true,
      log,
    },
    {
      findChatById: async () => {
        calls.push('findChatById');
        return {
          id: 'chat_1',
          userId: 'other_user',
          title: 'Admin visible chat',
        } as never;
      },
      findChatByIdForViewer: async () => {
        calls.push('findChatByIdForViewer');
        throw new Error('admin path should not use owner-only lookup');
      },
      getChatMessages: async () =>
        [
          {
            id: 'msg_1',
            chatId: 'chat_1',
            userId: 'other_user',
            role: 'assistant',
            parts: '{"bad":true}',
            metadata: '{"foo":"bar"}',
          },
        ] as never,
    }
  );

  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') return;
  assert.deepEqual(calls, ['findChatById']);
  assert.deepEqual(result.thread.messages[0]?.parts, []);
  assert.deepEqual(result.thread.messages[0]?.metadata, { foo: 'bar' });
  assert.equal(log.errorCalls.length, 1);
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
