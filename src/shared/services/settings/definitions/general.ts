import 'server-only';

import { envConfigs } from '@/config';

import type { Setting } from '../types';

function defaultSupportEmail(appUrl: string): string {
  try {
    const host = new URL(appUrl).host;
    if (!host || host.includes(':')) {
      return 'support@example.com';
    }
    return `support@${host}`;
  } catch {
    return 'support@example.com';
  }
}

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
    value: defaultSupportEmail(envConfigs.app_url),
    placeholder: 'support@example.com',
    group: 'general_brand',
    tab: 'general',
  },
  {
    name: 'general_ai_enabled',
    title: 'AI Module Enabled',
    type: 'switch',
    value: 'false',
    tip: 'When disabled, the AI module is globally unavailable (AI pages and APIs return 404).',
    group: 'general_ui',
    tab: 'general',
  },
  {
    name: 'general_blog_enabled',
    title: 'Blog Enabled',
    type: 'switch',
    value: 'false',
    group: 'general_ui',
    tab: 'general',
  },
  {
    name: 'general_docs_enabled',
    title: 'Docs Enabled',
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
