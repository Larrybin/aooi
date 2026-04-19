import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const googleAnalyticsGroup = {
  id: 'google_analytics',
  titleKey: 'groups.google_analytics',
  description:
    'custom your <a href="https://analytics.google.com/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Google Analytics</a> settings',
} as const;

const clarityGroup = {
  id: 'clarity',
  titleKey: 'groups.clarity',
  description:
    'custom your <a href="https://clarity.microsoft.com/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Clarity</a> settings',
} as const;

const plausibleGroup = {
  id: 'plausible',
  titleKey: 'groups.plausible',
  description:
    'custom your <a href="https://plausible.io/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Plausible</a> settings',
} as const;

const openpanelGroup = {
  id: 'openpanel',
  titleKey: 'groups.openpanel',
  description:
    'custom your <a href="https://openpanel.dev/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">OpenPanel</a> settings',
} as const;

const googleAnalyticsSettings = defineSettingsGroup(
  {
    moduleId: 'analytics',
    tab: 'analytics',
    group: googleAnalyticsGroup,
  },
  [
    {
      name: 'google_analytics_id',
      title: 'Google Analytics ID',
      type: 'text',
      placeholder: '',
    },
  ] as const
);

const claritySettings = defineSettingsGroup(
  {
    moduleId: 'analytics',
    tab: 'analytics',
    group: clarityGroup,
  },
  [
    {
      name: 'clarity_id',
      title: 'Clarity ID',
      type: 'text',
      placeholder: '',
    },
  ] as const
);

const plausibleSettings = defineSettingsGroup(
  {
    moduleId: 'analytics',
    tab: 'analytics',
    group: plausibleGroup,
  },
  [
    {
      name: 'plausible_domain',
      title: 'Plausible Domain',
      type: 'text',
      placeholder: '',
    },
    {
      name: 'plausible_src',
      title: 'Plausible Script Src',
      type: 'url',
      placeholder: 'https://plausible.io/js/script.js',
    },
  ] as const
);

const openpanelSettings = defineSettingsGroup(
  {
    moduleId: 'analytics',
    tab: 'analytics',
    group: openpanelGroup,
  },
  [
    {
      name: 'openpanel_client_id',
      title: 'OpenPanel Client ID',
      type: 'text',
      placeholder: '',
    },
  ] as const
);

export const analyticsSettings = [
  ...googleAnalyticsSettings,
  ...claritySettings,
  ...plausibleSettings,
  ...openpanelSettings,
] as const satisfies readonly SettingDefinition[];
