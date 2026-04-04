import 'server-only';

import { formatPostDate } from '@/shared/lib/post-date';
import {
  PostType as DbPostType,
  getPosts,
  getPostsCount,
  getPost as getRemotePost,
  PostStatus,
  type Post as RemotePost,
} from '@/shared/models/post';
import {
  findTaxonomy,
  getTaxonomies,
  getTaxonomiesCount,
  TaxonomyStatus,
  TaxonomyType,
  type Taxonomy,
} from '@/shared/models/taxonomy';
import type {
  Category as BlogCategoryType,
  Post as BlogPostType,
} from '@/shared/types/blocks/blog';

import {
  mergeBlogPostEntries,
  paginateBlogPostEntries,
  resolvePagination,
  toSortTimestamp,
  type BlogPostEntry,
} from './blog-feed';
import {
  getLocalBlogPostEntries,
  getLocalPage,
  getLocalPost,
} from './post-content';

export async function getDocsPage({
  slug,
  locale,
}: {
  slug: string;
  locale: string;
}): Promise<BlogPostType | null> {
  return getLocalPage({ slug, locale, pagePrefix: `/${locale}/` });
}

export async function getBlogPost({
  slug,
  locale,
  postPrefix = '/blog/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
}): Promise<BlogPostType | null> {
  const remotePost = await getRemotePost({ slug, locale, postPrefix });
  if (remotePost) {
    return remotePost;
  }

  return getLocalPost({ slug, locale, postPrefix });
}

export async function getBlogPostsAndCategories({
  page,
  pageSize,
  locale,
  postPrefix = '/blog/',
  categoryPrefix = '/blog/category/',
}: {
  page?: number | string | string[];
  pageSize?: number | string | string[];
  locale: string;
  postPrefix?: string;
  categoryPrefix?: string;
}) {
  const normalizedPagination = resolvePagination({ page, pageSize });

  const [localEntries, remoteEntries, categories] = await Promise.all([
    getLocalBlogPostEntries({
      locale,
      postPrefix,
    }),
    getPublishedRemoteBlogPostEntries({
      locale,
      postPrefix,
    }),
    getPublishedBlogCategories({
      categoryPrefix,
    }),
  ]);

  const mergedEntries = mergeBlogPostEntries({
    localEntries,
    remoteEntries,
  });
  const posts = paginateBlogPostEntries(
    mergedEntries,
    normalizedPagination.page,
    normalizedPagination.pageSize
  );

  return {
    posts,
    postsCount: mergedEntries.length,
    categories,
    categoriesCount: categories.length,
  };
}

export async function getBlogCategory({
  slug,
  categoryPrefix = '/blog/category/',
}: {
  slug: string;
  categoryPrefix?: string;
}): Promise<BlogCategoryType | null> {
  const category = await findTaxonomy({
    slug,
    status: TaxonomyStatus.PUBLISHED,
  });

  if (!category) {
    return null;
  }

  return toBlogCategory(category, categoryPrefix);
}

export async function getBlogCategoryPostsAndCategories({
  slug,
  page,
  pageSize,
  locale,
  postPrefix = '/blog/',
  categoryPrefix = '/blog/category/',
}: {
  slug: string;
  page?: number | string | string[];
  pageSize?: number | string | string[];
  locale: string;
  postPrefix?: string;
  categoryPrefix?: string;
}) {
  const normalizedPagination = resolvePagination({ page, pageSize });

  const [currentCategory, categories] = await Promise.all([
    getBlogCategory({
      slug,
      categoryPrefix,
    }),
    getPublishedBlogCategories({
      categoryPrefix,
    }),
  ]);

  if (!currentCategory?.id) {
    return null;
  }

  const remoteEntries = await getPublishedRemoteBlogPostEntries({
    locale,
    postPrefix,
    categoryId: currentCategory.id,
  });
  const posts = paginateBlogPostEntries(
    remoteEntries,
    normalizedPagination.page,
    normalizedPagination.pageSize
  );

  return {
    currentCategory,
    categories,
    categoriesCount: categories.length,
    posts,
    postsCount: remoteEntries.length,
  };
}

async function getPublishedRemoteBlogPostEntries({
  locale,
  postPrefix = '/blog/',
  categoryId,
}: {
  locale: string;
  postPrefix?: string;
  categoryId?: string;
}): Promise<BlogPostEntry[]> {
  const postsCount = await getPostsCount({
    type: DbPostType.ARTICLE,
    status: PostStatus.PUBLISHED,
    category: categoryId,
  });

  if (postsCount <= 0) {
    return [];
  }

  const posts = await getPosts({
    type: DbPostType.ARTICLE,
    status: PostStatus.PUBLISHED,
    category: categoryId,
    page: 1,
    limit: postsCount,
  });

  return posts
    .map((post) => toRemoteBlogPostEntry(post, locale, postPrefix))
    .sort((entryA, entryB) => entryB.sortTimestamp - entryA.sortTimestamp);
}

async function getPublishedBlogCategories({
  categoryPrefix = '/blog/category/',
}: {
  categoryPrefix?: string;
}) {
  const categoriesCount = await getTaxonomiesCount({
    type: TaxonomyType.CATEGORY,
    status: TaxonomyStatus.PUBLISHED,
  });

  if (categoriesCount <= 0) {
    return [] satisfies BlogCategoryType[];
  }

  const categories = await getTaxonomies({
    type: TaxonomyType.CATEGORY,
    status: TaxonomyStatus.PUBLISHED,
    page: 1,
    limit: categoriesCount,
  });

  return categories.map((category) => toBlogCategory(category, categoryPrefix));
}

function toRemoteBlogPostEntry(
  post: RemotePost,
  locale: string,
  postPrefix: string
): BlogPostEntry {
  const createdAtIso = post.createdAt.toISOString();

  return {
    post: {
      id: post.id,
      slug: post.slug,
      title: post.title || '',
      description: post.description || '',
      author_name: post.authorName || '',
      author_image: post.authorImage || '',
      created_at: formatPostDate(createdAtIso, locale),
      image: post.image || '',
      url: `${postPrefix}${post.slug}`,
    },
    sortTimestamp: toSortTimestamp(post.createdAt),
  };
}

function toBlogCategory(
  category: Taxonomy,
  categoryPrefix: string
): BlogCategoryType {
  return {
    id: category.id,
    slug: category.slug,
    title: category.title,
    url: `${categoryPrefix}${category.slug}`,
  };
}
