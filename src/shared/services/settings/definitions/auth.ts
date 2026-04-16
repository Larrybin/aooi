import type { SettingDefinition } from '../types';

const emailAuthGroup = {
  id: 'email_auth',
  titleKey: 'groups.email_auth',
  description: 'custom your email auth settings',
} as const;

const googleAuthGroup = {
  id: 'google_auth',
  titleKey: 'groups.google_auth',
  description: 'custom your google auth settings',
} as const;

const githubAuthGroup = {
  id: 'github_auth',
  titleKey: 'groups.github_auth',
  description: 'custom your github auth settings',
} as const;

export const authSettings = [
  {
    name: 'email_auth_enabled',
    title: 'Enabled',
    type: 'switch',
    moduleId: 'auth',
    visibility: 'public',
    value: 'true',
    group: emailAuthGroup,
    tab: 'auth',
  },
  {
    name: 'google_auth_enabled',
    title: 'Auth Enabled',
    type: 'switch',
    moduleId: 'auth',
    visibility: 'public',
    value: 'false',
    group: googleAuthGroup,
    tab: 'auth',
  },
  {
    name: 'google_one_tap_enabled',
    title: 'OneTap Enabled',
    type: 'switch',
    moduleId: 'auth',
    visibility: 'public',
    value: 'false',
    group: googleAuthGroup,
    tab: 'auth',
  },
  {
    name: 'google_client_id',
    title: 'Google Client ID',
    type: 'text',
    moduleId: 'auth',
    visibility: 'public',
    placeholder: '',
    group: googleAuthGroup,
    tab: 'auth',
  },
  {
    name: 'google_client_secret',
    title: 'Google Client Secret',
    type: 'password',
    moduleId: 'auth',
    visibility: 'private',
    placeholder: '',
    group: googleAuthGroup,
    tab: 'auth',
  },
  {
    name: 'github_auth_enabled',
    title: 'Auth Enabled',
    type: 'switch',
    moduleId: 'auth',
    visibility: 'public',
    group: githubAuthGroup,
    tab: 'auth',
  },
  {
    name: 'github_client_id',
    title: 'Github Client ID',
    type: 'text',
    moduleId: 'auth',
    visibility: 'private',
    placeholder: '',
    group: githubAuthGroup,
    tab: 'auth',
  },
  {
    name: 'github_client_secret',
    title: 'Github Client Secret',
    type: 'password',
    moduleId: 'auth',
    visibility: 'private',
    placeholder: '',
    group: githubAuthGroup,
    tab: 'auth',
  },
] as const satisfies readonly SettingDefinition[];
