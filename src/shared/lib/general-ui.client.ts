import { safeJsonParse } from '@/shared/lib/json';
import type { NavItem } from '@/shared/types/blocks/common';

export function isConfigTrue(configs: Record<string, string>, key: string) {
  return configs[key] === 'true';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTarget(value: unknown): '_self' | '_blank' {
  return value === '_self' ? '_self' : '_blank';
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
    if (!icon || !url) continue;

    const title = typeof item.title === 'string' ? item.title : '';
    const target = normalizeTarget(item.target);

    items.push({ title, icon, url, target });
  }

  return items;
}
