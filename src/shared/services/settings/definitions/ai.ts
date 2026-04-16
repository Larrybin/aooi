import type { SettingDefinition } from '../types';

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

export const aiSettings = [
  {
    name: 'general_ai_enabled',
    title: 'AI Module Enabled',
    type: 'switch',
    moduleId: 'ai',
    visibility: 'public',
    value: 'false',
    tip: 'When disabled, the AI module is globally unavailable (AI pages and APIs return 404).',
    group: aiModuleGroup,
    tab: 'ai',
  },
  {
    name: 'openrouter_api_key',
    title: 'OpenRouter API Key',
    type: 'password',
    moduleId: 'ai',
    visibility: 'private',
    placeholder: 'sk-or-',
    group: openrouterGroup,
    tab: 'ai',
  },
  {
    name: 'replicate_api_token',
    title: 'Replicate API Token',
    type: 'password',
    moduleId: 'ai',
    visibility: 'private',
    placeholder: 'r8_',
    group: replicateGroup,
    tab: 'ai',
  },
  {
    name: 'fal_api_key',
    title: 'Fal API Key',
    type: 'password',
    moduleId: 'ai',
    visibility: 'private',
    placeholder: 'fal_',
    group: falGroup,
    tip: 'Fal API Key is used to access the Fal API',
    tab: 'ai',
  },
  {
    name: 'kie_api_key',
    title: 'Kie API Key',
    type: 'password',
    moduleId: 'ai',
    visibility: 'private',
    placeholder: '',
    group: kieGroup,
    tip: 'Kie API Key is used to access the Kie API',
    tab: 'ai',
  },
] as const satisfies readonly SettingDefinition[];
