import { safeJsonParse } from '@/shared/lib/json';
import type { NavItem } from '@/shared/types/blocks/common';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTarget(value: unknown): '_self' | '_blank' {
  return value === '_self' ? '_self' : '_blank';
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseGeneralSocialLinks(
  json: string | undefined
): Array<NavItem> {
  if (!json) return [];

  const parsed = safeJsonParse<unknown>(json);
  if (!Array.isArray(parsed)) return [];

  const items: NavItem[] = [];

  for (const item of parsed) {
    if (!isRecord(item)) continue;
    if (item.enabled !== true) continue;

    const icon = typeof item.icon === 'string' ? item.icon.trim() : '';
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    if (!icon || !url || !isSafeHttpUrl(url)) continue;

    const title = typeof item.title === 'string' ? item.title : '';
    const target = normalizeTarget(item.target);

    items.push({ title, icon, url, target });
  }

  return items;
}
