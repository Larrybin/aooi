import { HeadInjectionManager } from '@/extensions/lib/head-injection-manager';

import type { AnalyticsProvider } from './types';

/**
 * Analytics manager to manage all analytics providers
 */
export class AnalyticsManager extends HeadInjectionManager<AnalyticsProvider> {}

export * from './types';
export * from './google-analytics';
export * from './clarity';
export * from './plausible';
export * from './open-panel';
