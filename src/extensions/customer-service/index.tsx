import type { ReactNode } from 'react';

import { HeadInjectionManager } from '@/extensions/lib/head-injection-manager';

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
  // provider name
  readonly name: string;

  // provider configs
  configs?: CustomerServiceConfigs;

  // meta tags inject to head
  getMetaTags?: () => ReactNode;

  // scripts inject to head
  getHeadScripts?: () => ReactNode;

  // scripts inject to body
  getBodyScripts?: () => ReactNode;
}

/**
 * Customer service manager to manage all customer service providers
 */
export class CustomerServiceManager extends HeadInjectionManager<CustomerServiceProvider> {}

export * from './tawk';
export * from './crisp';
