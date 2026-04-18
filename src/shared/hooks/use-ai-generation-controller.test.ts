import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { isAIGenerationTaskResponse } from './use-ai-generation-controller';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

test('isAIGenerationTaskResponse: 校验 query 返回结构', () => {
  assert.equal(
    isAIGenerationTaskResponse({
      id: 'task_1',
      status: 'processing',
      provider: 'replicate',
      model: 'google/nano-banana',
      prompt: 'hello',
      taskInfo: {},
    }),
    true
  );

  assert.equal(
    isAIGenerationTaskResponse({
      id: 'task_1',
      status: 'processing',
      provider: 'replicate',
      model: 123,
      prompt: 'hello',
      taskInfo: {},
    }),
    false
  );
});

test('useAiGenerationController: capability 选择逻辑只从 canonical 纯函数导入', async () => {
  const content = await readFile(
    path.resolve(currentDir, 'use-ai-generation-controller.ts'),
    'utf8'
  );

  assert.equal(
    content.includes(
      "import { resolveAICapabilitySelection } from '@/shared/lib/ai-capability-selection';"
    ),
    true
  );
  assert.equal(
    content.includes('export function resolveAICapabilitySelection('),
    false
  );
});
