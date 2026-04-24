import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const aiModuleGroup = {
  id: 'ai_module',
  titleKey: 'groups.ai_module',
  description: 'custom your ai module availability',
} as const;

const aiModuleSettings = defineSettingsGroup(
  {
    moduleId: 'ai',
    tab: 'ai',
    group: aiModuleGroup,
    defaultVisibility: 'public',
  },
  [
    {
      name: 'general_ai_enabled',
      title: 'AI Module Enabled',
      type: 'switch',
      value: 'false',
      tip: 'When disabled, the AI module is globally unavailable (AI pages and APIs return 404).',
    },
  ] as const
);

export const aiSettings = [
  ...aiModuleSettings,
] as const satisfies readonly SettingDefinition[];
