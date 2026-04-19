import type { ReactNode } from 'react';

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
  readonly name: string;
  configs?: AnalyticsConfigs;
  getMetaTags?: () => ReactNode;
  getHeadScripts?: () => ReactNode;
  getBodyScripts?: () => ReactNode;
}
