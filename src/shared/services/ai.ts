import 'server-only';

import { AIMediaType, type AIProvider } from '@/extensions/ai';
import { KieProvider, ReplicateProvider } from '@/extensions/ai/providers';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
import {
  ProviderRegistry,
  trimmedProviderNameKey,
} from '@/shared/lib/providers/provider-registry';
import type { Configs } from '@/shared/models/config';

import { buildServiceFromLatestConfigs } from './config_refresh_policy';

export type AIService = {
  getProvider(name: string): AIProvider | undefined;
  getDefaultProvider(): AIProvider | undefined;
  getMediaTypes(): string[];
};

/**
 * get ai manager with configs
 */
export function getAIServiceWithConfigs(configs: Configs) {
  const registry = new ProviderRegistry<AIProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  if (configs.kie_api_key) {
    registry.addUnique(
      new KieProvider({
        apiKey: configs.kie_api_key,
      }),
      {
        invalidNameError: () =>
          new ServiceUnavailableError('AI provider name is required'),
        duplicateNameError: (name) =>
          new ServiceUnavailableError(`AI provider '${name}' is already registered`),
      }
    );
  }

  if (configs.replicate_api_token) {
    registry.addUnique(
      new ReplicateProvider({
        apiToken: configs.replicate_api_token,
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

/**
 * global ai service
 */
export async function getAIService(options: {
  mode?: ConfigConsistencyMode;
} = {}): Promise<AIService> {
  return await buildServiceFromLatestConfigs(getAIServiceWithConfigs, options);
}
