import type { SettingDefinition } from '../types';
import { normalizeSocialLinks } from '../value-rules';
import { defineSettingsGroup } from './builder';

const generalUiGroup = {
  id: 'general_ui',
  titleKey: 'groups.general_ui',
  description: 'custom your general ui settings',
} as const;

const generalUiSettings = defineSettingsGroup(
  {
    moduleId: 'core_shell',
    tab: 'general',
    group: generalUiGroup,
    defaultVisibility: 'public',
  },
  [
    {
      name: 'general_social_links_enabled',
      title: 'Social Links Enabled',
      type: 'switch',
      value: 'false',
    },
    {
      name: 'general_locale_switcher_enabled',
      title: 'Language Switcher Enabled',
      type: 'switch',
      value: 'false',
      tip: 'Controls whether the language switcher is shown on public pages (Pricing, Sign in/up).',
    },
    {
      name: 'general_social_links',
      title: 'Social Links (JSON)',
      type: 'textarea',
      placeholder:
        '[{"title":"X","icon":"RiTwitterXFill","url":"https://x.com/<handle>","target":"_blank","enabled":true}]',
      tip: 'A JSON array of social links. Each item supports: title, icon, url, target, enabled. When enabled=true, url is required. Example icon values: RiYoutubeFill / RiPinterestFill / RiFacebookFill / Github / Mail',
      attributes: {
        rows: 10,
        className: 'font-mono text-xs',
      },
      normalizer: normalizeSocialLinks,
    },
  ] as const
);

export const generalSettings =
  generalUiSettings as readonly SettingDefinition[];
