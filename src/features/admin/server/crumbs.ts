import 'server-only';

import type { Crumb } from '@/shared/types/blocks/common';

type TranslationFunction = (key: string) => string;

export type CrumbSegment = {
  key: string;
  url?: string;
};

/**
 * Build admin breadcrumbs from translation keys
 *
 * @example
 * ```ts
 * const crumbs = buildAdminCrumbs(t, [
 *   { key: 'edit.crumbs.admin', url: '/admin' },
 *   { key: 'edit.crumbs.categories', url: '/admin/categories' },
 *   { key: 'edit.crumbs.edit' },
 * ]);
 * ```
 */
export function buildAdminCrumbs(
  t: TranslationFunction,
  segments: CrumbSegment[]
): Crumb[] {
  return segments.map((segment, index) => ({
    title: t(segment.key),
    url: segment.url,
    is_active: index === segments.length - 1,
  }));
}
