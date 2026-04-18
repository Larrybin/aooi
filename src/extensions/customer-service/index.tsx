import { HeadInjectionManager } from '@/extensions/lib/head-injection-manager';
import type { CustomerServiceProvider } from './types';

/**
 * Customer service manager to manage all customer service providers
 */
export class CustomerServiceManager extends HeadInjectionManager<CustomerServiceProvider> {}

export * from './types';
export * from './tawk';
export * from './crisp';
