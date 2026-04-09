import 'server-only';

import type { Setting } from '../types';

export const aiSettings: Setting[] = [
  {
    name: 'general_ai_enabled',
    title: 'AI Module Enabled',
    type: 'switch',
    value: 'false',
    tip: 'When disabled, the AI module is globally unavailable (AI pages and APIs return 404).',
    group: 'ai_module',
    tab: 'ai',
  },
  {
    name: 'openrouter_api_key',
    title: 'OpenRouter API Key',
    type: 'password',
    placeholder: 'sk-or-',
    group: 'openrouter',
    tab: 'ai',
  },
  {
    name: 'replicate_api_token',
    title: 'Replicate API Token',
    type: 'password',
    placeholder: 'r8_',
    group: 'replicate',
    tab: 'ai',
  },
  {
    name: 'fal_api_key',
    title: 'Fal API Key',
    type: 'password',
    placeholder: 'fal_',
    group: 'fal',
    tip: 'Fal API Key is used to access the Fal API',
    tab: 'ai',
  },
  {
    name: 'kie_api_key',
    title: 'Kie API Key',
    type: 'password',
    placeholder: '',
    group: 'kie',
    tip: 'Kie API Key is used to access the Kie API',
    tab: 'ai',
  },
];
