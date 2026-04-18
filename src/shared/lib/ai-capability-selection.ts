import type { AICapability } from '@/shared/types/ai-capability';

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
  const defaultCapabilities = capabilities.filter(
    (capability) => capability.isDefault
  );
  const resolvedSceneCapabilities =
    sceneCapabilities.length > 0
      ? sceneCapabilities
      : defaultCapabilities.length > 0
        ? defaultCapabilities
        : capabilities;
  const resolvedScene =
    resolvedSceneCapabilities.find((capability) => capability.isDefault)
      ?.scene ||
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
