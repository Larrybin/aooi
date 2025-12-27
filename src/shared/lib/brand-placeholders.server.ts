import 'server-only';

import { envConfigs } from '@/config';

export type BrandPlaceholderValues = {
  appName: string;
  appUrl: string;
  domain: string;
  supportEmail: string;
};

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function tryGetDomainFromOrigin(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return '';
  }
}

function defaultSupportEmail(domain: string): string {
  if (!domain) {
    return 'support@example.com';
  }

  // Avoid emitting invalid emails like support@localhost:3000
  if (domain.includes(':')) {
    return 'support@example.com';
  }

  return `support@${domain}`;
}

export function buildBrandPlaceholderValues(
  configs?: Record<string, string>
): BrandPlaceholderValues {
  const appUrl = safeTrim(configs?.app_url) || envConfigs.app_url;
  const appName = safeTrim(configs?.app_name) || envConfigs.app_name;
  const domain = tryGetDomainFromOrigin(appUrl);
  const supportEmail =
    safeTrim(configs?.general_support_email) || defaultSupportEmail(domain);

  return {
    appName,
    appUrl,
    domain,
    supportEmail,
  };
}

export function replaceBrandPlaceholders(
  input: string,
  brand: BrandPlaceholderValues
): string {
  let output = input;

  if (brand.supportEmail) {
    output = output.replaceAll(
      'mailto:support@your-domain.com',
      `mailto:${brand.supportEmail}`
    );
    output = output.replaceAll('support@your-domain.com', brand.supportEmail);
  }

  if (brand.appUrl) {
    output = output.replaceAll('https://your-domain.com', brand.appUrl);
    output = output.replaceAll('http://your-domain.com', brand.appUrl);
  }

  if (brand.domain) {
    output = output.replaceAll('your-domain.com', brand.domain);
  }

  if (brand.appName) {
    output = output.replaceAll('YourAppName', brand.appName);
    output = output.replaceAll('Roller Rabbit', brand.appName);
  }

  return output;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function replaceBrandPlaceholdersDeep<T>(
  value: T,
  brand: BrandPlaceholderValues
): T {
  if (typeof value === 'string') {
    return replaceBrandPlaceholders(value, brand) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceBrandPlaceholdersDeep(item, brand)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        replaceBrandPlaceholdersDeep(entryValue, brand),
      ])
    ) as T;
  }

  return value;
}
