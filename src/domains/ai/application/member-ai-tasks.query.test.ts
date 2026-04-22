import assert from 'node:assert/strict';
import test from 'node:test';

import { listMemberAiTasksQuery } from './member-ai-tasks.query';

test('listMemberAiTasksQuery 按 userId/mediaType/page/limit 聚合', async () => {
  const calls: unknown[] = [];

  const result = await listMemberAiTasksQuery(
    {
      userId: 'user_1',
      mediaType: 'music',
      page: 2,
      limit: 5,
    },
    {
      getAITasks: async (input) => {
        calls.push(input);
        return [{ id: 'task_1', userId: 'user_1' }] as never;
      },
      getAITasksCount: async (input) => {
        calls.push(input);
        return 1;
      },
    }
  );

  assert.equal(result.total, 1);
  assert.equal(result.rows.length, 1);
  assert.deepEqual(calls, [
    { userId: 'user_1', mediaType: 'music', page: 2, limit: 5 },
    { userId: 'user_1', mediaType: 'music' },
  ]);
});
