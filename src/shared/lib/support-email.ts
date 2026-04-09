export const DEFAULT_SUPPORT_EMAIL = 'support@example.com';

export function getDomainFromOrigin(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return '';
  }
}

export function getDefaultSupportEmailFromDomain(domain: string): string {
  if (!domain || domain.includes(':')) {
    return DEFAULT_SUPPORT_EMAIL;
  }

  return `support@${domain}`;
}

export function getDefaultSupportEmailFromOrigin(origin: string): string {
  return getDefaultSupportEmailFromDomain(getDomainFromOrigin(origin));
}
