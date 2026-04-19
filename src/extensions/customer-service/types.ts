import type { ReactNode } from 'react';

/**
 * Customer service configs interface
 */
export interface CustomerServiceConfigs {
  [key: string]: unknown;
}

/**
 * Customer service provider interface
 */
export interface CustomerServiceProvider {
  readonly name: string;
  configs?: CustomerServiceConfigs;
  getMetaTags?: () => ReactNode;
  getHeadScripts?: () => ReactNode;
  getBodyScripts?: () => ReactNode;
}
