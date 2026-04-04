import type { Post as BlogPostType } from '@/shared/types/blocks/blog';

export type BlogPostEntry = {
  post: BlogPostType;
  sortTimestamp: number;
};

type PaginationValue = number | string | string[] | undefined;

export function normalizePositiveInteger(
  value: PaginationValue,
  fallback: number
): number {
  const normalizedValue = Array.isArray(value) ? value[0] : value;

  if (typeof normalizedValue === 'number') {
    return Number.isInteger(normalizedValue) && normalizedValue > 0
      ? normalizedValue
      : fallback;
  }

  if (typeof normalizedValue !== 'string') {
    return fallback;
  }

  const trimmedValue = normalizedValue.trim();
  if (!/^\d+$/.test(trimmedValue)) {
    return fallback;
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);
  return parsedValue > 0 ? parsedValue : fallback;
}

export function resolvePagination({
  page,
  pageSize,
  defaultPage = 1,
  defaultPageSize = 30,
}: {
  page?: PaginationValue;
  pageSize?: PaginationValue;
  defaultPage?: number;
  defaultPageSize?: number;
}) {
  return {
    page: normalizePositiveInteger(page, defaultPage),
    pageSize: normalizePositiveInteger(pageSize, defaultPageSize),
  };
}

export function toSortTimestamp(value?: Date | string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp =
    value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeBlogPostEntries({
  localEntries,
  remoteEntries,
}: {
  localEntries: BlogPostEntry[];
  remoteEntries: BlogPostEntry[];
}) {
  const mergedEntries = new Map<string, BlogPostEntry>();

  localEntries.forEach((entry, index) => {
    mergedEntries.set(entry.post.slug || `local-${index}`, entry);
  });

  remoteEntries.forEach((entry, index) => {
    mergedEntries.set(entry.post.slug || `remote-${index}`, entry);
  });

  return Array.from(mergedEntries.values()).sort((entryA, entryB) => {
    return entryB.sortTimestamp - entryA.sortTimestamp;
  });
}

export function paginateBlogPostEntries(
  entries: BlogPostEntry[],
  page: number,
  pageSize: number
) {
  const offset = (page - 1) * pageSize;

  return entries.slice(offset, offset + pageSize).map((entry) => entry.post);
}
