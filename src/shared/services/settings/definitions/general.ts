import { envConfigs } from '@/config';
import { getDefaultSupportEmailFromOrigin } from '@/shared/lib/support-email';

import type { SettingDefinition } from '../types';
import {
  normalizeAppFavicon,
  normalizeAppLogo,
  normalizeAppName,
  normalizeAppOgImage,
  normalizeAppUrl,
  normalizeSocialLinks,
  normalizeSupportEmail,
} from '../value-rules';

const generalBrandGroup = {
  id: 'general_brand',
  titleKey: 'groups.general_brand',
  description: 'custom your brand settings',
} as const;

const generalUiGroup = {
  id: 'general_ui',
  titleKey: 'groups.general_ui',
  description: 'custom your general ui settings',
} as const;

export const generalSettings = [
  {
    name: 'app_name',
    title: 'App Name',
    type: 'text',
    moduleId: 'core_shell',
    visibility: 'public',
    value: envConfigs.app_name,
    placeholder: 'My App',
    group: generalBrandGroup,
    tab: 'general',
    normalizer: normalizeAppName,
  },
  {
    name: 'app_url',
    title: 'App URL (Origin)',
    type: 'text',
    moduleId: 'core_shell',
    visibility: 'public',
    value: envConfigs.app_url,
    placeholder: 'https://your-domain.com',
    tip: 'Must be a pure origin (http/https), e.g. https://example.com (no path/query). Used for canonical URLs, sitemap, and callbacks.',
    group: generalBrandGroup,
    tab: 'general',
    normalizer: normalizeAppUrl,
  },
  {
    name: 'general_support_email',
    title: 'Support Email',
    type: 'text',
    moduleId: 'core_shell',
    visibility: 'public',
    value: getDefaultSupportEmailFromOrigin(envConfigs.app_url),
    placeholder: 'support@example.com',
    group: generalBrandGroup,
    tab: 'general',
    normalizer: normalizeSupportEmail,
  },
  {
    name: 'app_logo',
    title: 'App Logo',
    type: 'upload_image',
    moduleId: 'core_shell',
    visibility: 'public',
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
    group: generalBrandGroup,
    tab: 'general',
    normalizer: normalizeAppLogo,
  },
  {
    name: 'app_favicon',
    title: 'Favicon',
    type: 'upload_image',
    moduleId: 'core_shell',
    visibility: 'public',
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
    group: generalBrandGroup,
    tab: 'general',
    normalizer: normalizeAppFavicon,
  },
  {
    name: 'app_og_image',
    title: 'Preview Image',
    type: 'upload_image',
    moduleId: 'core_shell',
    visibility: 'public',
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
    group: generalBrandGroup,
    tab: 'general',
    normalizer: normalizeAppOgImage,
  },
  {
    name: 'general_social_links_enabled',
    title: 'Social Links Enabled',
    type: 'switch',
    moduleId: 'core_shell',
    visibility: 'public',
    value: 'false',
    group: generalUiGroup,
    tab: 'general',
  },
  {
    name: 'general_locale_switcher_enabled',
    title: 'Language Switcher Enabled',
    type: 'switch',
    moduleId: 'core_shell',
    visibility: 'public',
    value: 'false',
    tip: 'Controls whether the language switcher is shown on public pages (Pricing, Sign in/up).',
    group: generalUiGroup,
    tab: 'general',
  },
  {
    name: 'general_social_links',
    title: 'Social Links (JSON)',
    type: 'textarea',
    moduleId: 'core_shell',
    visibility: 'public',
    placeholder:
      '[{"title":"X","icon":"RiTwitterXFill","url":"https://x.com/<handle>","target":"_blank","enabled":true}]',
    tip: 'A JSON array of social links. Each item supports: title, icon, url, target, enabled. When enabled=true, url is required. Example icon values: RiYoutubeFill / RiPinterestFill / RiFacebookFill / Github / Mail',
    attributes: {
      rows: 10,
      className: 'font-mono text-xs',
    },
    group: generalUiGroup,
    tab: 'general',
    normalizer: normalizeSocialLinks,
  },
] as const satisfies readonly SettingDefinition[];
