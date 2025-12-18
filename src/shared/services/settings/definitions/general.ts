import 'server-only';

import type { Setting } from '../types';

export const generalSettings: Setting[] = [
  {
    name: 'general_built_with_enabled',
    title: 'Built With Enabled',
    type: 'switch',
    value: 'false',
    group: 'general_ui',
    tab: 'general',
  },
  {
    name: 'general_theme_toggle_enabled',
    title: 'Theme Toggle Enabled',
    type: 'switch',
    value: 'false',
    group: 'general_ui',
    tab: 'general',
  },
  {
    name: 'general_social_links_enabled',
    title: 'Social Links Enabled',
    type: 'switch',
    value: 'false',
    group: 'general_ui',
    tab: 'general',
  },
  {
    name: 'general_social_links',
    title: 'Social Links (JSON)',
    type: 'textarea',
    placeholder:
      '[{"title":"X","icon":"RiTwitterXFill","url":"https://x.com/your-app","target":"_blank","enabled":true}]',
    tip: 'A JSON array of social links. Each item supports: title, icon, url, target, enabled. When enabled=true, url is required. Example icon values: RiYoutubeFill / RiPinterestFill / RiFacebookFill / Github / Mail',
    attributes: {
      rows: 10,
      className: 'font-mono text-xs',
    },
    group: 'general_ui',
    tab: 'general',
  },
];

