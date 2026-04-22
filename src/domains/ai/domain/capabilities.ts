import { AIMediaType } from '@/extensions/ai';
import type {
  AICapability,
  AICapabilitySelection,
} from '@/shared/types/ai-capability';

export type AIProviderAvailability = {
  kie: boolean;
  replicate: boolean;
};

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

function isProviderAvailable(
  availability: AIProviderAvailability,
  provider: string
) {
  switch (provider) {
    case 'kie':
      return availability.kie;
    case 'replicate':
      return availability.replicate;
    default:
      return false;
  }
}

export function listAvailableAICapabilities(
  availability: AIProviderAvailability
) {
  return AI_CAPABILITY_CATALOG.filter((capability) =>
    isProviderAvailable(availability, capability.provider)
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

export function resolveAICapability(
  availability: AIProviderAvailability,
  selection: AICapabilitySelection
) {
  return findAICapability(listAvailableAICapabilities(availability), selection);
}
