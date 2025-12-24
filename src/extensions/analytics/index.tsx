import type { ReactNode } from 'react';

import { HeadInjectionManager } from '@/extensions/lib/head-injection-manager';

/**
 * Analytics configs interface
 */
export interface AnalyticsConfigs {
  [key: string]: unknown;
}

/**
 * Analytics provider interface
 */
export interface AnalyticsProvider {
  // provider name
  readonly name: string;

  // provider configs
  configs?: AnalyticsConfigs;

  // meta tags inject to head
  getMetaTags?: () => ReactNode;

  // scripts inject to head
  getHeadScripts?: () => ReactNode;

  // scripts inject to body
  getBodyScripts?: () => ReactNode;
}

/**
 * Analytics manager to manage all analytics providers
 */
export class AnalyticsManager extends HeadInjectionManager<AnalyticsProvider> {}

export * from './google-analytics';
export * from './clarity';
export * from './plausible';
export * from './open-panel';
export * from './vercel-analytics';
