import type { SettingDefinition } from '../types';

const resendGroup = {
  id: 'resend',
  titleKey: 'groups.resend',
  description: 'custom your resend settings',
} as const;

export const emailSettings = [
  {
    name: 'resend_api_key',
    title: 'Resend API Key',
    type: 'password',
    moduleId: 'auth',
    visibility: 'private',
    placeholder: '',
    group: resendGroup,
    tab: 'email',
  },
  {
    name: 'resend_sender_email',
    title: 'Resend Sender Email',
    type: 'email',
    moduleId: 'auth',
    visibility: 'private',
    placeholder: '',
    group: resendGroup,
    tab: 'email',
  },
] as const satisfies readonly SettingDefinition[];
