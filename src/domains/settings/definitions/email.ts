import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const resendGroup = {
  id: 'resend',
  titleKey: 'groups.resend',
  description: 'custom your resend settings',
} as const;

export const emailSettings = defineSettingsGroup(
  {
    moduleId: 'auth',
    tab: 'email',
    group: resendGroup,
  },
  [
    {
      name: 'resend_sender_email',
      title: 'Resend Sender Email',
      type: 'email',
      placeholder: '',
    },
  ] as const
) satisfies readonly SettingDefinition[];
