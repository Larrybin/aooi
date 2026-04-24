import { HeadInjectionManager } from '@/extensions/lib/head-injection-manager';

import type { AffiliateProvider } from './types';

/**
 * Affiliate manager to manage all affiliate providers
 */
export class AffiliateManager extends HeadInjectionManager<AffiliateProvider> {}

export * from './types';
export * from './affonso';
export * from './promotekit';
