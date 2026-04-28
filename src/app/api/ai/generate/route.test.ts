import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType, AITaskStatus, type AIProvider } from '@/extensions/ai';
import { BadRequestError } from '@/shared/lib/api/errors';

import {
  createAiGeneratePostHandler,
  type AiGenerateRouteDeps,
} from './create-handler';

type AiGenerateCreateApiContext = AiGenerateRouteDeps['createApiContext'];
type NewAiTask = Parameters<AiGenerateRouteDeps['createAITask']>[0];
type AiTaskRecord = Awaited<ReturnType<AiGenerateRouteDeps['createAITask']>>;
type UpdateAiTaskPatch = Parameters<AiGenerateRouteDeps['updateAITaskById']>[1];

function createApiContextStub(body: {
  provider: string;
  mediaType: AIMediaType;
  model: string;
  prompt?: string;
  options?: Record<string, unknown>;
  scene?: string;
}): AiGenerateCreateApiContext {
  return () => ({
    log: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    parseJson: async () => body,
    requireUser: async () => ({ id: 'user_1' }),
  });
}

function createAiTaskRecord(
  task: NewAiTask,
  overrides: Partial<AiTaskRecord> = {}
): AiTaskRecord {
  return {
    id: task.id,
    userId: task.userId,
    mediaType: task.mediaType,
    provider: task.provider,
    model: task.model,
    prompt: task.prompt,
    options: task.options ?? null,
    status: task.status,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    deletedAt: null,
    taskId: task.taskId ?? null,
    taskInfo: task.taskInfo ?? null,
    taskResult: task.taskResult ?? null,
    costCredits: task.costCredits ?? 0,
    scene: task.scene ?? '',
    creditId: task.creditId ?? null,
    ...overrides,
  };
}

function createAiGenerateProvider(): AIProvider {
  return {
    name: 'replicate',
    configs: {},
    generate: async () => ({
      taskStatus: AITaskStatus.PROCESSING,
      taskId: 'provider-task-1',
      taskInfo: { step: 'queued' },
    }),
  };
}

function createEmptyAiService() {
  return {
    getProvider: () => undefined,
    getDefaultProvider: () => undefined,
    getMediaTypes: () => [],
  };
}

test('ai/generate 路由使用 resolver 返回的 canonical scene 和 costCredits', async () => {
  let createdTask: Record<string, unknown> | undefined;

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
    readAiRuntimeSettings: async () => ({ aiEnabled: true }),
    readAiProviderBindings: () => ({
      openrouterApiKey: '',
      replicateApiToken: 'token_1',
      falApiKey: '',
      kieApiKey: '',
    }),
    resolveConfiguredAICapability: () => ({
      mediaType: AIMediaType.IMAGE,
      scene: 'image-to-image',
      provider: 'replicate',
      model: 'google/nano-banana',
      label: 'Nano Banana',
      costCredits: 4,
      isDefault: true,
    }),
    getAIService: () => ({
      getProvider: () => createAiGenerateProvider(),
      getDefaultProvider: () => undefined,
      getMediaTypes: () => [],
    }),
    getUuid: () => 'db-task-1',
    createAITask: async (task) => {
      createdTask = task as Record<string, unknown>;
      return createAiTaskRecord(task, {
        creditId: 'credit-1',
      });
    },
    updateAITaskById: async (_id, patch: UpdateAiTaskPatch) =>
      createAiTaskRecord(
        {
          id: 'db-task-1',
          userId: 'user_1',
          mediaType: AIMediaType.IMAGE,
          provider: 'replicate',
          model: 'google/nano-banana',
          prompt: 'hello',
          status: AITaskStatus.PENDING,
        },
        patch
      ),
  });

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.ok(createdTask);
  assert.equal(createdTask.scene, 'image-to-image');
  assert.equal(createdTask.costCredits, 4);
  assert.equal(createdTask.provider, 'replicate');
  assert.equal(createdTask.model, 'google/nano-banana');

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
    readAiRuntimeSettings: async () => ({ aiEnabled: true }),
    readAiProviderBindings: () => ({
      openrouterApiKey: '',
      replicateApiToken: '',
      falApiKey: '',
      kieApiKey: 'key_1',
    }),
    resolveConfiguredAICapability: () => {
      throw new BadRequestError('invalid ai capability');
    },
    getAIService: createEmptyAiService,
    getUuid: () => 'db-task-1',
    createAITask: async () => {
      throw new Error('should not create task');
    },
    updateAITaskById: async () => {
      throw new Error('should not update task');
    },
  } satisfies AiGenerateRouteDeps);

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
