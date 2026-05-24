import type { ProductRuntimeContract } from '@/domains/product-runtime/domain/contract';

export const AI_REMOVER_RUNTIME_CONTRACT = {
  siteKey: 'ai-remover',
  productKey: 'ai-remover',
  requiredWorkers: {
    'public-web': true,
  },
  requiredBindings: {
    workersAi: true,
  },
  requiredVars: {
    storagePublicBaseUrl: true,
  },
  requiredSecrets: {
    removerCleanup: true,
  },
} satisfies ProductRuntimeContract;
