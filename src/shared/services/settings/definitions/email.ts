import 'server-only';

import type { Setting } from '../types';

export const emailSettings: Setting[] = [
  {
    name: 'resend_api_key',
    title: 'Resend API Key',
    type: 'password',
    placeholder: '',
    group: 'resend',
    tab: 'email',
  },
  {
    name: 'resend_sender_email',
    title: 'Resend Sender Email',
    type: 'email',
    placeholder: '',
    group: 'resend',
    tab: 'email',
  },
];

