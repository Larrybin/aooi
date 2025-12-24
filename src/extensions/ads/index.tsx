import type { ReactNode } from 'react';

import { HeadInjectionManager } from '@/extensions/lib/head-injection-manager';

/**
 * Ads configs interface
 */
export interface AdsConfigs {
  [key: string]: unknown;
}

// Ads provider interface
export interface AdsProvider {
  // provider name
  readonly name: string;

  // provider configs
  configs: AdsConfigs;

  // meta tags inject to head
  getMetaTags: () => ReactNode;

  // scripts inject to head
  getHeadScripts: () => ReactNode;

  // scripts inject to body
  getBodyScripts: () => ReactNode;
}

/**
 * Ads manager to manage all ads providers
 */
export class AdsManager extends HeadInjectionManager<AdsProvider> {}

export * from './adsense';
