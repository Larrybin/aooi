import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType } from '@/extensions/ai';
import { resolveAICapabilitySelection } from '@/shared/lib/ai-capability-selection';

import {
  listConfiguredAICapabilities,
  resolveConfiguredAICapability,
} from './capabilities';

test('listConfiguredAICapabilities: 仅暴露当前 provider 已配置的能力', () => {
  const imageCapabilities = listConfiguredAICapabilities({
    replicate_api_token: 'token',
  });
  assert.equal(
    imageCapabilities.every(
      (capability) => capability.mediaType === AIMediaType.IMAGE
    ),
    true
  );

  const musicCapabilities = listConfiguredAICapabilities({
    kie_api_key: 'token',
  });
  assert.equal(
    musicCapabilities.every(
      (capability) => capability.mediaType === AIMediaType.MUSIC
    ),
    true
  );
});

test('resolveConfiguredAICapability: 返回 canonical scene 和 costCredits', () => {
  const capability = resolveConfiguredAICapability(
    {
      replicate_api_token: 'token',
    },
    {
      mediaType: AIMediaType.IMAGE,
      scene: 'image-to-image',
      provider: 'replicate',
      model: 'google/nano-banana',
    }
  );

  assert.equal(capability.costCredits, 4);
  assert.equal(capability.scene, 'image-to-image');
});

test('resolveConfiguredAICapability: 非法组合抛错', () => {
  assert.throws(() =>
    resolveConfiguredAICapability(
      {
        replicate_api_token: 'token',
      },
      {
        mediaType: AIMediaType.MUSIC,
        scene: 'text-to-music',
        provider: 'kie',
        model: 'V5',
      }
    )
  );
});

test('resolveAICapabilitySelection: 缺省时回落到默认能力', () => {
  const result = resolveAICapabilitySelection(
    [
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
    ],
    {}
  );

  assert.equal(result.scene, 'text-to-image');
  assert.equal(result.provider, 'replicate');
  assert.equal(result.model, 'black-forest-labs/flux-schnell');
  assert.equal(result.capability?.costCredits, 2);
});

test('resolveAICapabilitySelection: scene 变化后自动切到该场景默认模型', () => {
  const result = resolveAICapabilitySelection(
    [
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
    ],
    {
      scene: 'image-to-image',
    }
  );

  assert.equal(result.scene, 'image-to-image');
  assert.equal(result.model, 'google/nano-banana');
  assert.equal(result.capability?.costCredits, 4);
});
