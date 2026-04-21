import assert from 'node:assert/strict';
import test from 'node:test';

import { refreshMemberAiTaskUseCase } from './member-ai-tasks.actions';

test('refreshMemberAiTaskUseCase 对不存在或越权任务返回 hidden', async () => {
  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        findAITaskById: async () => undefined as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () => undefined,
      }
    ),
    { status: 'hidden' }
  );

  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'other_user',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'pending',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () => undefined,
      }
    ),
    { status: 'hidden' }
  );
});

test('refreshMemberAiTaskUseCase 对 provider 缺失返回 invalid_provider', async () => {
  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'pending',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () => undefined,
      }
    ),
    { status: 'invalid_provider' }
  );
});

test('refreshMemberAiTaskUseCase 对 pending/processing 查询 provider 并更新任务', async () => {
  const updates: Array<{ id: string; update: Record<string, unknown> }> = [];

  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'pending',
            creditId: 'credit_1',
          }) as never,
        updateAITaskById: async (id, update) => {
          updates.push({ id, update: update as Record<string, unknown> });
          return { id, ...update } as never;
        },
        getProvider: async () =>
          ({
            query: async () => ({
              taskStatus: 'success',
              taskInfo: { foo: 'bar' },
              taskResult: { id: 'result_1' },
            }),
          }) as never,
      }
    ),
    { status: 'ok' }
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.id, 'task_1');
});

test('refreshMemberAiTaskUseCase 对非待处理状态不查询 provider', async () => {
  let providerCalls = 0;

  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'success',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () => {
          providerCalls += 1;
          return undefined;
        },
      }
    ),
    { status: 'ok' }
  );

  assert.equal(providerCalls, 0);
});
