import 'server-only';

import { getConfiguredAIService } from '@/domains/ai/application/service';
import {
  CLOUDFLARE_WORKERS_AI_PROVIDER,
  createAIProviderRemoverAdapter,
  createCloudflareWorkersAIRemoverAdapter,
  DEFAULT_CLOUDFLARE_INPAINTING_MODEL,
  type RemoverProviderAdapter,
} from '@/domains/remover/application/provider';
import {
  getCloudflareAIBinding,
  getRuntimeEnvString,
} from '@/infra/runtime/env.server';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';

export async function resolveRemoverProviderAdapter(): Promise<RemoverProviderAdapter> {
  const providerName =
    getRuntimeEnvString('REMOVER_AI_PROVIDER')?.trim() ||
    CLOUDFLARE_WORKERS_AI_PROVIDER;
  const configuredModel = getRuntimeEnvString('REMOVER_AI_MODEL')?.trim();
  const model =
    configuredModel ||
    (providerName === CLOUDFLARE_WORKERS_AI_PROVIDER
      ? DEFAULT_CLOUDFLARE_INPAINTING_MODEL
      : '');
  if (!model) {
    throw new ServiceUnavailableError('REMOVER_AI_MODEL is not configured');
  }

  if (providerName === CLOUDFLARE_WORKERS_AI_PROVIDER) {
    const ai = getCloudflareAIBinding();
    if (!ai) {
      throw new ServiceUnavailableError('Cloudflare Workers AI is not bound');
    }

    return createCloudflareWorkersAIRemoverAdapter({ ai, model });
  }

  const aiService = await getConfiguredAIService();
  const provider = aiService.getProvider(providerName);
  if (!provider) {
    throw new ServiceUnavailableError(
      `AI provider '${providerName}' is not configured`
    );
  }

  return createAIProviderRemoverAdapter({ provider, model });
}
