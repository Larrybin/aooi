import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const aiModuleGroup = {
  id: 'ai_module',
  titleKey: 'groups.ai_module',
  description: 'custom your ai module availability',
} as const;

const openrouterGroup = {
  id: 'openrouter',
  titleKey: 'groups.openrouter',
  description:
    'Custom <a href="https://openrouter.ai" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">OpenRouter</a> settings',
} as const;

const replicateGroup = {
  id: 'replicate',
  titleKey: 'groups.replicate',
  description:
    'Custom <a href="https://replicate.com" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Replicate</a> settings',
} as const;

const falGroup = {
  id: 'fal',
  titleKey: 'groups.fal',
  description:
    'Custom <a href="https://fal.ai" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Fal</a> settings',
} as const;

const kieGroup = {
  id: 'kie',
  titleKey: 'groups.kie',
  description:
    'Custom <a href="https://kie.ai" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Kie</a> settings',
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

const openrouterSettings = defineSettingsGroup(
  {
    moduleId: 'ai',
    tab: 'ai',
    group: openrouterGroup,
  },
  [
    {
      name: 'openrouter_api_key',
      title: 'OpenRouter API Key',
      type: 'password',
      placeholder: 'sk-or-',
    },
  ] as const
);

const replicateSettings = defineSettingsGroup(
  {
    moduleId: 'ai',
    tab: 'ai',
    group: replicateGroup,
  },
  [
    {
      name: 'replicate_api_token',
      title: 'Replicate API Token',
      type: 'password',
      placeholder: 'r8_',
    },
  ] as const
);

const falSettings = defineSettingsGroup(
  {
    moduleId: 'ai',
    tab: 'ai',
    group: falGroup,
  },
  [
    {
      name: 'fal_api_key',
      title: 'Fal API Key',
      type: 'password',
      placeholder: 'fal_',
      tip: 'Fal API Key is used to access the Fal API',
    },
  ] as const
);

const kieSettings = defineSettingsGroup(
  {
    moduleId: 'ai',
    tab: 'ai',
    group: kieGroup,
  },
  [
    {
      name: 'kie_api_key',
      title: 'Kie API Key',
      type: 'password',
      placeholder: '',
      tip: 'Kie API Key is used to access the Kie API',
    },
  ] as const
);

export const aiSettings = [
  ...aiModuleSettings,
  ...openrouterSettings,
  ...replicateSettings,
  ...falSettings,
  ...kieSettings,
] as const satisfies readonly SettingDefinition[];
