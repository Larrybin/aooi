import type { Post as BlogPostType } from '@/shared/types/blocks/blog';

export type BlogPostEntry = {
  post: BlogPostType;
  sortTimestamp: number;
};

const DEFAULT_BLOG_PAGE_SIZE = 30;

export function getDefaultBlogPageSize() {
  return DEFAULT_BLOG_PAGE_SIZE;
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
