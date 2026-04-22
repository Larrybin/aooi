import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import type { Configs } from '@/domains/settings/application/settings-runtime.query';
import {
  listAvailableAICapabilities,
  resolveAICapability,
  type AIProviderAvailability,
} from '@/domains/ai/domain/capabilities';
import type {
  AICapability,
  AICapabilitySelection,
} from '@/shared/types/ai-capability';

function toAIProviderAvailability(configs: Configs): AIProviderAvailability {
  return {
    kie: Boolean(configs.kie_api_key),
    replicate: Boolean(configs.replicate_api_token),
  };
}

export function listConfiguredAICapabilities(configs: Configs) {
  return listAvailableAICapabilities(toAIProviderAvailability(configs));
}

export function resolveConfiguredAICapability(
  configs: Configs,
  selection: AICapabilitySelection
) {
  const capability = resolveAICapability(
    toAIProviderAvailability(configs),
    selection
  );

  if (!capability) {
    throw new BadRequestError('invalid ai capability');
  }

  return capability;
}

export async function listPublicAICapabilities() {
  const { readRuntimeSettingsCached } = await import('@/domains/settings/application/settings-runtime.query');
  const configs = await readRuntimeSettingsCached();

  return listConfiguredAICapabilities(configs);
}

export async function resolvePublicAICapability(selection: AICapabilitySelection) {
  const { readRuntimeSettingsCached } = await import('@/domains/settings/application/settings-runtime.query');
  const configs = await readRuntimeSettingsCached();

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
