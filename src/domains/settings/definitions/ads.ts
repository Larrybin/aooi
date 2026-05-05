import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const adsBasicGroup = {
  id: 'ads_basic',
  titleKey: 'groups.ads_basic',
  description: 'choose the active ads provider and enable the ads runtime',
} as const;

const adsenseGroup = {
  id: 'adsense',
  titleKey: 'groups.adsense',
  description:
    'custom your <a href="https://adsense.google.com/" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">AdSense</a> runtime and zone settings',
} as const;

const adsterraGroup = {
  id: 'adsterra',
  titleKey: 'groups.adsterra',
  description:
    'custom your <a href="https://adsterra.com/blog/set-up-publishers-dashboard/#add-your-first-website-and-start-monetizing" class="text-primary" target="_blank" rel="nofollow noopener noreferrer">Adsterra</a> snippet and zone settings',
} as const;

const basicAdsSettings = defineSettingsGroup(
  {
    moduleId: 'ads',
    tab: 'ads',
    group: adsBasicGroup,
  },
  [
    {
      name: 'ads_enabled',
      title: 'Ads Enabled',
      type: 'switch',
      value: 'false',
      tip: 'Enable a single active ads provider for the current site.',
    },
    {
      name: 'ads_provider',
      title: 'Active Provider',
      type: 'select',
      value: 'adsense',
      options: [
        { title: 'AdSense', value: 'adsense' },
        { title: 'Adsterra', value: 'adsterra' },
      ],
      tip: 'Only one ads provider can be active at a time.',
    },
  ] as const
);

const adsenseSettings = defineSettingsGroup(
  {
    moduleId: 'ads',
    tab: 'ads',
    group: adsenseGroup,
  },
  [
    {
      name: 'adsense_client_id',
      title: 'AdSense Client ID',
      type: 'text',
      placeholder: 'ca-pub-',
    },
    {
      name: 'adsense_slot_landing_inline_primary',
      title: 'AdSense Landing Inline Primary Slot',
      type: 'text',
      placeholder: '1234567890',
    },
    {
      name: 'adsense_slot_blog_post_inline',
      title: 'AdSense Blog Post Inline Slot',
      type: 'text',
      placeholder: '1234567890',
    },
    {
      name: 'adsense_slot_blog_post_footer',
      title: 'AdSense Blog Post Footer Slot',
      type: 'text',
      placeholder: '1234567890',
    },
  ] as const
);

const adsterraSettings = defineSettingsGroup(
  {
    moduleId: 'ads',
    tab: 'ads',
    group: adsterraGroup,
  },
  [
    {
      name: 'adsterra_mode',
      title: 'Adsterra Mode',
      type: 'select',
      value: 'native_banner',
      options: [
        { title: 'Social Bar', value: 'social_bar' },
        { title: 'Popunder', value: 'popunder' },
        { title: 'Native Banner', value: 'native_banner' },
        { title: 'Display Banner', value: 'display_banner' },
      ],
      tip: 'Choose whether Adsterra runs as a global script mode or as in-page named zones.',
    },
    {
      name: 'adsterra_global_snippet',
      title: 'Adsterra Global Snippet',
      type: 'textarea',
      attributes: {
        rows: 8,
      },
      placeholder: `<script type="text/javascript" src="https://example.com/adsterra-global.js"></script>`,
      tip: 'Paste a supported Adsterra Social Bar or Popunder snippet. Only restricted Adsterra script markup is rendered.',
    },
    {
      name: 'adsterra_zone_landing_inline_primary_snippet',
      title: 'Adsterra Landing Inline Primary Snippet',
      type: 'textarea',
      attributes: {
        rows: 8,
      },
      placeholder: `<script type="text/javascript">\n  atOptions = { ... };\n</script>\n<script type="text/javascript" src="https://example.com/invoke.js"></script>`,
      tip: 'Paste a supported Adsterra zone snippet for this landing placement.',
    },
    {
      name: 'adsterra_zone_blog_post_inline_snippet',
      title: 'Adsterra Blog Post Inline Snippet',
      type: 'textarea',
      attributes: {
        rows: 8,
      },
      placeholder: `<script type="text/javascript">\n  atOptions = { ... };\n</script>\n<script type="text/javascript" src="https://example.com/invoke.js"></script>`,
      tip: 'Paste a supported Adsterra zone snippet for the inline blog post placement.',
    },
    {
      name: 'adsterra_zone_blog_post_footer_snippet',
      title: 'Adsterra Blog Post Footer Snippet',
      type: 'textarea',
      attributes: {
        rows: 8,
      },
      placeholder: `<script type="text/javascript">\n  atOptions = { ... };\n</script>\n<script type="text/javascript" src="https://example.com/invoke.js"></script>`,
      tip: 'Paste a supported Adsterra zone snippet for the footer blog post placement.',
    },
    {
      name: 'adsterra_ads_txt_entry',
      title: 'Adsterra ads.txt Entry',
      type: 'text',
      placeholder: 'example.com, publisher-id, DIRECT',
      tip: 'Optional. Paste the exact ads.txt line if Adsterra provides one for your account.',
    },
  ] as const
);

export const adsSettings = [
  ...basicAdsSettings,
  ...adsenseSettings,
  ...adsterraSettings,
] as const satisfies readonly SettingDefinition[];
