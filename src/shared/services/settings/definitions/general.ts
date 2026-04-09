import 'server-only';

import { envConfigs } from '@/config';
import { getDefaultSupportEmailFromOrigin } from '@/shared/lib/support-email';

import type { Setting } from '../types';

export const generalSettings: Setting[] = [
  {
    name: 'app_name',
    title: 'App Name',
    type: 'text',
    value: envConfigs.app_name,
    placeholder: 'My App',
    group: 'general_brand',
    tab: 'general',
  },
  {
    name: 'app_url',
    title: 'App URL (Origin)',
    type: 'text',
    value: envConfigs.app_url,
    placeholder: 'https://your-domain.com',
    tip: 'Must be a pure origin (http/https), e.g. https://example.com (no path/query). Used for canonical URLs, sitemap, and callbacks.',
    group: 'general_brand',
    tab: 'general',
  },
  {
    name: 'general_support_email',
    title: 'Support Email',
    type: 'text',
    value: getDefaultSupportEmailFromOrigin(envConfigs.app_url),
    placeholder: 'support@example.com',
    group: 'general_brand',
    tab: 'general',
  },
  {
    name: 'app_logo',
    title: 'App Logo',
    type: 'upload_image',
    value: envConfigs.app_logo,
    placeholder:
      'Upload your brand logo (recommended square image). Requires Storage to be configured.',
    tip: 'Used in docs nav, auth pages, admin/sidebar brand area, and 404 page.',
    attributes: {
      accept: 'image/*,.ico',
    },
    metadata: {
      max: 1,
      maxSizeMB: 5,
    },
    group: 'general_brand',
    tab: 'general',
  },
  {
    name: 'app_favicon',
    title: 'Favicon',
    type: 'upload_image',
    value: envConfigs.app_favicon,
    placeholder:
      'Upload favicon image (.ico/.png recommended). Requires Storage to be configured.',
    tip: 'Used as the global site icon in metadata.',
    attributes: {
      accept: 'image/*,.ico',
    },
    metadata: {
      max: 1,
      maxSizeMB: 2,
    },
    group: 'general_brand',
    tab: 'general',
  },
  {
    name: 'app_og_image',
    title: 'Preview Image',
    type: 'upload_image',
    value: envConfigs.app_og_image,
    placeholder:
      'Upload social preview image (recommended 1200x630). Requires Storage to be configured.',
    tip: 'Used for Open Graph and Twitter preview cards.',
    attributes: {
      accept: 'image/*,.ico',
    },
    metadata: {
      max: 1,
      maxSizeMB: 5,
    },
    group: 'general_brand',
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
    name: 'general_locale_switcher_enabled',
    title: 'Language Switcher Enabled',
    type: 'switch',
    value: 'false',
    tip: 'Controls whether the language switcher is shown on public pages (Pricing, Sign in/up).',
    group: 'general_ui',
    tab: 'general',
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
    group: 'general_ui',
    tab: 'general',
  },
];
