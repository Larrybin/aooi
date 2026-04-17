import type { AIMediaType } from '@/extensions/ai';

export type AICapability = {
  mediaType: AIMediaType;
  scene: string;
  provider: string;
  model: string;
  label: string;
  costCredits: number;
  isDefault: boolean;
};

export type AICapabilitySelection = Pick<
  AICapability,
  'mediaType' | 'scene' | 'provider' | 'model'
>;

