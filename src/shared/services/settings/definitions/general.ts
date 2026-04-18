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
import { defineSettingsGroup } from './builder';

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

const generalBrandSettings = defineSettingsGroup(
  {
    moduleId: 'core_shell',
    tab: 'general',
    group: generalBrandGroup,
    defaultVisibility: 'public',
  },
  [
    {
      name: 'app_name',
      title: 'App Name',
      type: 'text',
      value: envConfigs.app_name,
      placeholder: 'My App',
      normalizer: normalizeAppName,
    },
    {
      name: 'app_url',
      title: 'App URL (Origin)',
      type: 'text',
      value: envConfigs.app_url,
      placeholder: 'https://your-domain.com',
      tip: 'Must be a pure origin (http/https), e.g. https://example.com (no path/query). Used for canonical URLs, sitemap, and callbacks.',
      normalizer: normalizeAppUrl,
    },
    {
      name: 'general_support_email',
      title: 'Support Email',
      type: 'text',
      value: getDefaultSupportEmailFromOrigin(envConfigs.app_url),
      placeholder: 'support@example.com',
      normalizer: normalizeSupportEmail,
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
        storageValueMode: 'objectKey',
      },
      normalizer: normalizeAppLogo,
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
        storageValueMode: 'objectKey',
      },
      normalizer: normalizeAppFavicon,
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
        storageValueMode: 'objectKey',
      },
      normalizer: normalizeAppOgImage,
    },
  ] as const
);

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

export const generalSettings = [
  ...generalBrandSettings,
  ...generalUiSettings,
] as const satisfies readonly SettingDefinition[];
