import type { ProductRuntimeContract } from '@/domains/product-runtime/domain/contract';

export const BACKGROUND_REMOVER_RUNTIME_CONTRACT = {
  siteKey: 'background-remover',
  productKey: 'background-remover',
  requiredWorkers: {
    'public-web': true,
  },
  requiredVars: {
    storagePublicBaseUrl: true,
  },
  requiredSecrets: {
    removerCleanup: true,
  },
} satisfies ProductRuntimeContract;
