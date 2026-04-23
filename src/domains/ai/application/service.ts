import 'server-only';

import { AIMediaType, type AIProvider } from '@/extensions/ai';
import { KieProvider, ReplicateProvider } from '@/extensions/ai/providers';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import {
  ProviderRegistry,
  trimmedProviderNameKey,
} from '@/shared/lib/providers/provider-registry';
import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { getAiProviderBindings } from './provider-bindings';

export type AIService = {
  getProvider(name: string): AIProvider | undefined;
  getDefaultProvider(): AIProvider | undefined;
  getMediaTypes(): string[];
};

/**
 * get ai manager with configs
 */
export function getAIService({
  settings: _settings,
  bindings,
}: {
  settings: AiRuntimeSettings;
  bindings: AiProviderBindings;
}) {
  const registry = new ProviderRegistry<AIProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  if (bindings.kieApiKey) {
    registry.addUnique(
      new KieProvider({
        apiKey: bindings.kieApiKey,
      }),
      {
        invalidNameError: () =>
          new ServiceUnavailableError('AI provider name is required'),
        duplicateNameError: (name) =>
          new ServiceUnavailableError(`AI provider '${name}' is already registered`),
      }
    );
  }

  if (bindings.replicateApiToken) {
    registry.addUnique(
      new ReplicateProvider({
        apiToken: bindings.replicateApiToken,
      }),
      {
        invalidNameError: () =>
          new ServiceUnavailableError('AI provider name is required'),
        duplicateNameError: (name) =>
          new ServiceUnavailableError(`AI provider '${name}' is already registered`),
      }
    );
  }

  return {
    getProvider: (name) => registry.get(name),
    getDefaultProvider: () => registry.getDefault(),
    getMediaTypes: () => Object.values(AIMediaType),
  } satisfies AIService;
}

export async function getConfiguredAIService(): Promise<AIService> {
  const { readAiRuntimeSettingsCached } = await import(
    '@/domains/settings/application/settings-runtime.query'
  );
  return getAIService({
    settings: await readAiRuntimeSettingsCached(),
    bindings: getAiProviderBindings(),
  });
}
