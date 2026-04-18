import type { ReactNode } from 'react';

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
  readonly name: string;
  configs?: AffiliateConfigs;
  getMetaTags?: () => ReactNode;
  getHeadScripts?: () => ReactNode;
  getBodyScripts?: () => ReactNode;
}
