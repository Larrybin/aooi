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

export async function listPublicAICapabilities() {
  const { getAllConfigsCached } = await import('@/shared/models/config');
  const configs = await getAllConfigsCached();

  return listConfiguredAICapabilities(configs);
}

export async function resolvePublicAICapability(selection: AICapabilitySelection) {
  const { getAllConfigsCached } = await import('@/shared/models/config');
  const configs = await getAllConfigsCached();

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
