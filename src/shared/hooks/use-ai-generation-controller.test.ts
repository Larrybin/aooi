import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType } from '@/extensions/ai';
import type { AICapability } from '@/shared/types/ai-capability';

import {
  isAIGenerationTaskResponse,
  resolveAICapabilitySelection,
} from './use-ai-generation-controller';

const CAPABILITIES: AICapability[] = [
  {
    mediaType: AIMediaType.IMAGE,
    scene: 'text-to-image',
    provider: 'replicate',
    model: 'black-forest-labs/flux-schnell',
    label: 'FLUX Schnell',
    costCredits: 2,
    isDefault: true,
  },
  {
    mediaType: AIMediaType.IMAGE,
    scene: 'image-to-image',
    provider: 'replicate',
    model: 'google/nano-banana',
    label: 'Nano Banana',
    costCredits: 4,
    isDefault: true,
  },
];

test('resolveAICapabilitySelection: 缺省时回落到默认能力', () => {
  const result = resolveAICapabilitySelection(CAPABILITIES, {});

  assert.equal(result.scene, 'text-to-image');
  assert.equal(result.provider, 'replicate');
  assert.equal(result.model, 'black-forest-labs/flux-schnell');
  assert.equal(result.capability?.costCredits, 2);
});

test('resolveAICapabilitySelection: scene 变化后自动切到该场景默认模型', () => {
  const result = resolveAICapabilitySelection(CAPABILITIES, {
    scene: 'image-to-image',
  });

  assert.equal(result.scene, 'image-to-image');
  assert.equal(result.model, 'google/nano-banana');
  assert.equal(result.capability?.costCredits, 4);
});

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

