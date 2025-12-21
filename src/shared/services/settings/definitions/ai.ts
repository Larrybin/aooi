import 'server-only';

import type { Setting } from '../types';

export const aiSettings: Setting[] = [
  {
    name: 'openrouter_api_key',
    title: 'OpenRouter API Key',
    type: 'password',
    placeholder: 'sk-or-xxx',
    group: 'openrouter',
    tab: 'ai',
  },
  {
    name: 'replicate_api_token',
    title: 'Replicate API Token',
    type: 'password',
    placeholder: 'r8_xxx',
    group: 'replicate',
    tab: 'ai',
  },
  {
    name: 'fal_api_key',
    title: 'Fal API Key',
    type: 'password',
    placeholder: 'fal_xxx',
    group: 'fal',
    tip: 'Fal API Key is used to access the Fal API',
    tab: 'ai',
  },
  {
    name: 'kie_api_key',
    title: 'Kie API Key',
    type: 'password',
    placeholder: 'xxx',
    group: 'kie',
    tip: 'Kie API Key is used to access the Kie API',
    tab: 'ai',
  },
];
