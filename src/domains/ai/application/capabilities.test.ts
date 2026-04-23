import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType } from '@/extensions/ai';
import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { resolveAICapabilitySelection } from '@/domains/ai/domain/capability-selection';

import {
  listConfiguredAICapabilities,
  resolveConfiguredAICapability,
} from './capabilities';

const AI_SETTINGS: AiRuntimeSettings = {
  aiEnabled: true,
};

const AI_DISABLED_SETTINGS: AiRuntimeSettings = {
  aiEnabled: false,
};

const REPLICATE_BINDINGS: AiProviderBindings = {
  openrouterApiKey: '',
  replicateApiToken: 'token',
  falApiKey: '',
  kieApiKey: '',
};

const KIE_BINDINGS: AiProviderBindings = {
  openrouterApiKey: '',
  replicateApiToken: '',
  falApiKey: '',
  kieApiKey: 'token',
};

test('listConfiguredAICapabilities: 仅暴露当前 provider 已配置的能力', () => {
  const imageCapabilities = listConfiguredAICapabilities(
    AI_SETTINGS,
    REPLICATE_BINDINGS
  );
  assert.equal(
    imageCapabilities.every(
      (capability) => capability.mediaType === AIMediaType.IMAGE
    ),
    true
  );

  const musicCapabilities = listConfiguredAICapabilities(
    AI_SETTINGS,
    KIE_BINDINGS
  );
  assert.equal(
    musicCapabilities.every(
      (capability) => capability.mediaType === AIMediaType.MUSIC
    ),
    true
  );
});

test('listConfiguredAICapabilities: ai disabled 时返回空数组', () => {
  assert.deepEqual(
    listConfiguredAICapabilities(AI_DISABLED_SETTINGS, REPLICATE_BINDINGS),
    []
  );
});

test('resolveConfiguredAICapability: 返回 canonical scene 和 costCredits', () => {
  const capability = resolveConfiguredAICapability(
    AI_SETTINGS,
    REPLICATE_BINDINGS,
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
      AI_SETTINGS,
      REPLICATE_BINDINGS,
      {
        mediaType: AIMediaType.MUSIC,
        scene: 'text-to-music',
        provider: 'kie',
        model: 'V5',
      }
    )
  );
});

test('resolveConfiguredAICapability: ai disabled 时返回 capability unavailable', () => {
  assert.throws(
    () =>
      resolveConfiguredAICapability(
        AI_DISABLED_SETTINGS,
        REPLICATE_BINDINGS,
        {
          mediaType: AIMediaType.IMAGE,
          scene: 'image-to-image',
          provider: 'replicate',
          model: 'google/nano-banana',
        }
      ),
    /ai capability not available/
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
