import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

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

const emailAuthSettings = defineSettingsGroup(
  {
    moduleId: 'auth',
    tab: 'auth',
    group: emailAuthGroup,
    defaultVisibility: 'public',
  },
  [
    {
      name: 'email_auth_enabled',
      title: 'Enabled',
      type: 'switch',
      value: 'true',
    },
  ] as const
);

const googleAuthSettings = defineSettingsGroup(
  {
    moduleId: 'auth',
    tab: 'auth',
    group: googleAuthGroup,
    defaultVisibility: 'private',
  },
  [
    {
      name: 'google_auth_enabled',
      title: 'Auth Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
    {
      name: 'google_one_tap_enabled',
      title: 'OneTap Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
  ] as const
);

const githubAuthSettings = defineSettingsGroup(
  {
    moduleId: 'auth',
    tab: 'auth',
    group: githubAuthGroup,
  },
  [
    {
      name: 'github_auth_enabled',
      title: 'Auth Enabled',
      type: 'switch',
      visibility: 'public',
      value: 'false',
    },
  ] as const
);

export const authSettings = [
  ...emailAuthSettings,
  ...googleAuthSettings,
  ...githubAuthSettings,
] as const satisfies readonly SettingDefinition[];
