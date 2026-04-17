import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType } from '@/extensions/ai';
import { BadRequestError } from '@/shared/lib/api/errors';

import { createAiGeneratePostHandler } from './create-handler';

function createApiContextStub(body: {
  provider: string;
  mediaType: AIMediaType;
  model: string;
  prompt?: string;
  options?: Record<string, unknown>;
  scene?: string;
}) {
  return () =>
    ({
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      parseJson: async () => body,
      requireUser: async () => ({ id: 'user_1' }),
    }) as never;
}

test('ai/generate 路由使用 resolver 返回的 canonical scene 和 costCredits', async () => {
  let createdTask: Record<string, unknown> | null = null;

  const handler = createAiGeneratePostHandler({
    requireAiEnabled: async () => undefined,
    createApiContext: createApiContextStub({
      mediaType: AIMediaType.IMAGE,
      scene: 'input-scene',
      provider: 'replicate',
      model: 'raw-model',
      prompt: 'hello',
      options: { image_input: ['https://example.com/a.png'] },
    }),
    getAllConfigs: async () => ({ app_url: 'https://app.example.com' }) as never,
    resolveConfiguredAICapability: () => ({
      mediaType: AIMediaType.IMAGE,
      scene: 'image-to-image',
      provider: 'replicate',
      model: 'google/nano-banana',
      label: 'Nano Banana',
      costCredits: 4,
      isDefault: true,
    }),
    getAIManagerWithConfigs: () =>
      ({
        getProvider: () => ({
          generate: async () => ({
            taskId: 'provider-task-1',
            taskInfo: { step: 'queued' },
          }),
        }),
      }) as never,
    getUuid: () => 'db-task-1',
    createAITask: async (task) => {
      createdTask = task as Record<string, unknown>;
      return {
        ...task,
        id: 'db-task-1',
        creditId: 'credit-1',
      } as never;
    },
    updateAITaskById: async (_id, patch) =>
      ({
        id: 'db-task-1',
        ...patch,
      }) as never,
  });

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(createdTask?.scene, 'image-to-image');
  assert.equal(createdTask?.costCredits, 4);
  assert.equal(createdTask?.provider, 'replicate');
  assert.equal(createdTask?.model, 'google/nano-banana');

  const body = (await response.json()) as {
    data: { taskId: string; taskInfo: string };
  };
  assert.equal(body.data.taskId, 'provider-task-1');
  assert.equal(body.data.taskInfo, JSON.stringify({ step: 'queued' }));
});

test('ai/generate 路由非法 capability 统一返回 400', async () => {
  const handler = createAiGeneratePostHandler({
    requireAiEnabled: async () => undefined,
    createApiContext: createApiContextStub({
      mediaType: AIMediaType.MUSIC,
      scene: 'text-to-music',
      provider: 'kie',
      model: 'V5',
      prompt: 'hello',
    }),
    getAllConfigs: async () => ({}) as never,
    resolveConfiguredAICapability: () => {
      throw new BadRequestError('invalid ai capability');
    },
  });

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 400);

  const body = (await response.json()) as {
    code: number;
    message: string;
  };
  assert.equal(body.code, -1);
  assert.equal(body.message, 'invalid ai capability');
});
