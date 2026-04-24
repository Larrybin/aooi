import { listPublicAICapabilities } from '@/domains/ai/application/capabilities';

import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import type { AICapability } from '@/shared/types/ai-capability';

type AiCapabilitiesRouteDeps = {
  listCapabilities: () => Promise<AICapability[]>;
};

export function createAiCapabilitiesGetHandler(
  overrides: Partial<AiCapabilitiesRouteDeps> = {}
) {
  const deps: AiCapabilitiesRouteDeps = {
    listCapabilities: listPublicAICapabilities,
    ...overrides,
  };

  return async () => {
    const capabilities = await deps.listCapabilities();

    return jsonOk(
      { capabilities },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  };
}

export const GET = withApi(createAiCapabilitiesGetHandler());
