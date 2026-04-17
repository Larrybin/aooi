import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType } from '@/extensions/ai';

import {
  listConfiguredAICapabilities,
  resolveConfiguredAICapability,
} from './ai-capabilities';

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

