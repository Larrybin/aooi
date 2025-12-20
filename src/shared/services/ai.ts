import 'server-only';

import { AIManager } from '@/extensions/ai';
import { KieProvider, ReplicateProvider } from '@/extensions/ai/providers';
import type { Configs } from '@/shared/models/config';

import { buildServiceFromLatestConfigs } from './config_refresh_policy';

/**
 * get ai manager with configs
 */
export function getAIManagerWithConfigs(configs: Configs) {
  const aiManager = new AIManager();

  if (configs.kie_api_key) {
    aiManager.addProvider(
      new KieProvider({
        apiKey: configs.kie_api_key,
      })
    );
  }

  if (configs.replicate_api_token) {
    aiManager.addProvider(
      new ReplicateProvider({
        apiToken: configs.replicate_api_token,
      })
    );
  }

  return aiManager;
}

/**
 * global ai service
 */
export async function getAIService(): Promise<AIManager> {
  return await buildServiceFromLatestConfigs(getAIManagerWithConfigs);
}
