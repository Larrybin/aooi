import { AIMediaType } from '@/extensions/ai';
import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import type { Configs } from '@/shared/models/config';
import type {
  AICapability,
  AICapabilitySelection,
} from '@/shared/types/ai-capability';

const AI_CAPABILITY_CATALOG: AICapability[] = [
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
    scene: 'text-to-image',
    provider: 'replicate',
    model: 'google/nano-banana',
    label: 'Nano Banana',
    costCredits: 2,
    isDefault: false,
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
  {
    mediaType: AIMediaType.IMAGE,
    scene: 'text-to-image',
    provider: 'replicate',
    model: 'bytedance/seedream-4',
    label: 'Seedream 4',
    costCredits: 2,
    isDefault: false,
  },
  {
    mediaType: AIMediaType.IMAGE,
    scene: 'image-to-image',
    provider: 'replicate',
    model: 'bytedance/seedream-4',
    label: 'Seedream 4',
    costCredits: 4,
    isDefault: false,
  },
  {
    mediaType: AIMediaType.MUSIC,
    scene: 'text-to-music',
    provider: 'kie',
    model: 'V5',
    label: 'Suno V5',
    costCredits: 10,
    isDefault: true,
  },
  {
    mediaType: AIMediaType.MUSIC,
    scene: 'text-to-music',
    provider: 'kie',
    model: 'V4_5PLUS',
    label: 'Suno V4.5+',
    costCredits: 10,
    isDefault: false,
  },
  {
    mediaType: AIMediaType.MUSIC,
    scene: 'text-to-music',
    provider: 'kie',
    model: 'V4_5',
    label: 'Suno V4.5',
    costCredits: 10,
    isDefault: false,
  },
  {
    mediaType: AIMediaType.MUSIC,
    scene: 'text-to-music',
    provider: 'kie',
    model: 'V4',
    label: 'Suno V4',
    costCredits: 10,
    isDefault: false,
  },
  {
    mediaType: AIMediaType.MUSIC,
    scene: 'text-to-music',
    provider: 'kie',
    model: 'V3_5',
    label: 'Suno V3.5',
    costCredits: 10,
    isDefault: false,
  },
];

function isProviderConfigured(configs: Configs, provider: string) {
  switch (provider) {
    case 'kie':
      return Boolean(configs.kie_api_key);
    case 'replicate':
      return Boolean(configs.replicate_api_token);
    default:
      return false;
  }
}

export function listConfiguredAICapabilities(configs: Configs) {
  return AI_CAPABILITY_CATALOG.filter((capability) =>
    isProviderConfigured(configs, capability.provider)
  );
}

export function findAICapability(
  capabilities: AICapability[],
  selection: AICapabilitySelection
) {
  return capabilities.find(
    (capability) =>
      capability.mediaType === selection.mediaType &&
      capability.scene === selection.scene &&
      capability.provider === selection.provider &&
      capability.model === selection.model
  );
}

export function resolveConfiguredAICapability(
  configs: Configs,
  selection: AICapabilitySelection
) {
  const capability = findAICapability(
    listConfiguredAICapabilities(configs),
    selection
  );

  if (!capability) {
    throw new BadRequestError('invalid ai capability');
  }

  return capability;
}

export function resolveAICapabilitySelection(
  capabilities: AICapability[],
  selection: Partial<Pick<AICapability, 'scene' | 'provider' | 'model'>>
) {
  if (capabilities.length === 0) {
    return {
      scene: '',
      provider: '',
      model: '',
      capability: undefined,
    };
  }

  const sceneCapabilities = capabilities.filter(
    (capability) => capability.scene === selection.scene
  );
  const defaultCapabilities = capabilities.filter((capability) => capability.isDefault);
  const resolvedSceneCapabilities =
    sceneCapabilities.length > 0
      ? sceneCapabilities
      : defaultCapabilities.length > 0
        ? defaultCapabilities
        : capabilities;
  const resolvedScene =
    resolvedSceneCapabilities.find((capability) => capability.isDefault)?.scene ||
    resolvedSceneCapabilities[0]?.scene ||
    '';

  const providerCapabilities = capabilities.filter(
    (capability) => capability.scene === resolvedScene
  );
  const selectedProviderCapabilities = providerCapabilities.filter(
    (capability) => capability.provider === selection.provider
  );
  const defaultProviderCapabilities = providerCapabilities.filter(
    (capability) => capability.isDefault
  );
  const resolvedProviderCapabilities =
    selectedProviderCapabilities.length > 0
      ? selectedProviderCapabilities
      : defaultProviderCapabilities.length > 0
        ? defaultProviderCapabilities
        : providerCapabilities;
  const resolvedProvider =
    resolvedProviderCapabilities.find((capability) => capability.isDefault)
      ?.provider ||
    resolvedProviderCapabilities[0]?.provider ||
    '';

  const modelCapabilities = providerCapabilities.filter(
    (capability) => capability.provider === resolvedProvider
  );
  const selectedCapability = modelCapabilities.find(
    (capability) => capability.model === selection.model
  );
  const capability =
    selectedCapability ||
    modelCapabilities.find((item) => item.isDefault) ||
    modelCapabilities[0];

  return {
    scene: capability?.scene || resolvedScene,
    provider: capability?.provider || resolvedProvider,
    model: capability?.model || '',
    capability,
  };
}

export async function listPublicAICapabilities() {
  const { getAllConfigs } = await import('@/shared/models/config');
  const configs = await getAllConfigs();

  return listConfiguredAICapabilities(configs);
}

export async function resolvePublicAICapability(selection: AICapabilitySelection) {
  const { getAllConfigs } = await import('@/shared/models/config');
  const configs = await getAllConfigs();

  return resolveConfiguredAICapability(configs, selection);
}

export function requireCapability(
  capability: AICapability | undefined
): AICapability {
  if (!capability) {
    throw new ServiceUnavailableError('ai capability not available');
  }

  return capability;
}
