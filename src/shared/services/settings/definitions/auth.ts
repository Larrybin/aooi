import 'server-only';

import type { Setting } from '../types';

export const authSettings: Setting[] = [
  {
    name: 'email_auth_enabled',
    title: 'Enabled',
    type: 'switch',
    value: 'true',
    group: 'email_auth',
    tab: 'auth',
  },
  {
    name: 'google_auth_enabled',
    title: 'Auth Enabled',
    type: 'switch',
    value: 'false',
    group: 'google_auth',
    tab: 'auth',
  },
  {
    name: 'google_one_tap_enabled',
    title: 'OneTap Enabled',
    type: 'switch',
    value: 'false',
    group: 'google_auth',
    tab: 'auth',
  },
  {
    name: 'google_client_id',
    title: 'Google Client ID',
    type: 'text',
    placeholder: '',
    group: 'google_auth',
    tab: 'auth',
  },
  {
    name: 'google_client_secret',
    title: 'Google Client Secret',
    type: 'password',
    placeholder: '',
    group: 'google_auth',
    tab: 'auth',
  },
  {
    name: 'github_auth_enabled',
    title: 'Auth Enabled',
    type: 'switch',
    group: 'github_auth',
    tab: 'auth',
  },
  {
    name: 'github_client_id',
    title: 'Github Client ID',
    type: 'text',
    placeholder: '',
    group: 'github_auth',
    tab: 'auth',
  },
  {
    name: 'github_client_secret',
    title: 'Github Client Secret',
    type: 'password',
    placeholder: '',
    group: 'github_auth',
    tab: 'auth',
  },
];
