import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

export function isAiEnabled(config: PublicUiConfig | undefined) {
  return Boolean(config?.aiEnabled);
}
