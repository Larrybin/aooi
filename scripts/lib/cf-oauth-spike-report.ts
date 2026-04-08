import type { OAuthSpikeReport } from '../../tests/smoke/oauth-spike.shared';

const BETTER_AUTH_COOKIE_VALUE_PATTERN =
  /(__Secure-better-auth\.[^=;\s]+)=([^;\r\n]+)/g;
const JSON_TOKEN_PATTERN = /("token"\s*:\s*")([^"]+)(")/g;

export function redactOAuthSpikeString(value: string): string {
  return value
    .replace(BETTER_AUTH_COOKIE_VALUE_PATTERN, '$1=[REDACTED]')
    .replace(JSON_TOKEN_PATTERN, '$1[REDACTED]$3');
}

function sanitizeOAuthSpikeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactOAuthSpikeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOAuthSpikeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeOAuthSpikeValue(item),
      ])
    );
  }

  return value;
}

export function sanitizeOAuthSpikeReport(
  report: OAuthSpikeReport
): OAuthSpikeReport {
  return sanitizeOAuthSpikeValue(report) as OAuthSpikeReport;
}
