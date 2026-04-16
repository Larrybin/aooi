import type { SettingDefinition } from '../types';

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

const vercelAnalyticsGroup = {
  id: 'vercel_analytics',
  titleKey: 'groups.vercel_analytics',
  description:
    'custom your <a href="https://vercel.com/docs/analytics/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Vercel Analytics</a> settings',
} as const;

export const analyticsSettings = [
  {
    name: 'google_analytics_id',
    title: 'Google Analytics ID',
    type: 'text',
    moduleId: 'analytics',
    visibility: 'private',
    placeholder: '',
    group: googleAnalyticsGroup,
    tab: 'analytics',
  },
  {
    name: 'clarity_id',
    title: 'Clarity ID',
    type: 'text',
    moduleId: 'analytics',
    visibility: 'private',
    placeholder: '',
    group: clarityGroup,
    tab: 'analytics',
  },
  {
    name: 'plausible_domain',
    title: 'Plausible Domain',
    type: 'text',
    moduleId: 'analytics',
    visibility: 'private',
    placeholder: '',
    group: plausibleGroup,
    tab: 'analytics',
  },
  {
    name: 'plausible_src',
    title: 'Plausible Script Src',
    type: 'url',
    moduleId: 'analytics',
    visibility: 'private',
    placeholder: 'https://plausible.io/js/script.js',
    group: plausibleGroup,
    tab: 'analytics',
  },
  {
    name: 'openpanel_client_id',
    title: 'OpenPanel Client ID',
    type: 'text',
    moduleId: 'analytics',
    visibility: 'private',
    placeholder: '',
    group: openpanelGroup,
    tab: 'analytics',
  },
  {
    name: 'vercel_analytics_enabled',
    title: 'Enabled',
    type: 'switch',
    moduleId: 'analytics',
    visibility: 'private',
    value: 'false',
    group: vercelAnalyticsGroup,
    tab: 'analytics',
  },
] as const satisfies readonly SettingDefinition[];
