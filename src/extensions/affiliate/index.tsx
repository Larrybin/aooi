import type { ReactNode } from 'react';

import { HeadInjectionManager } from '@/extensions/lib/head-injection-manager';

/**
 * Affiliate configs interface
 */
export interface AffiliateConfigs {
  [key: string]: unknown;
}

/**
 * Affiliate provider interface
 */
export interface AffiliateProvider {
  // provider name
  readonly name: string;

  // provider configs
  configs?: AffiliateConfigs;

  // meta tags inject to head
  getMetaTags?: () => ReactNode;

  // scripts inject to head
  getHeadScripts?: () => ReactNode;

  // scripts inject to body
  getBodyScripts?: () => ReactNode;
}

/**
 * Affiliate manager to manage all affiliate providers
 */
export class AffiliateManager extends HeadInjectionManager<AffiliateProvider> {}

export * from './affonso';
export * from './promotekit';
