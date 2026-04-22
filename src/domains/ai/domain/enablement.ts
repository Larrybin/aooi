import { isConfigTrue } from '@/shared/lib/general-ui.client';

export const GENERAL_AI_ENABLED = 'general_ai_enabled';

export function isAiEnabled(publicConfigs: Record<string, string> | undefined) {
  return isConfigTrue(publicConfigs ?? {}, GENERAL_AI_ENABLED);
}
