import 'server-only';

import type { post } from '@/config/db/schema';
import {
  generatePostTocFromMarkdown,
  getLocalPage as getLocalPageFromContent,
  getLocalPost as getLocalPostFromContent,
  getLocalPostsAndCategories as getLocalPostsAndCategoriesFromContent,
} from '@/shared/content/post_content';
import { logger } from '@/shared/lib/logger.server';
import { formatPostDate } from '@/shared/lib/post-date';
import type {
  Category as BlogCategoryType,
  Post as BlogPostType,
} from '@/shared/types/blocks/blog';

import {
  addPostRow,
  findPostRow,
  getPostRows,
  getPostRowsCount,
  updatePostRow,
} from './post_repo';
import { getTaxonomies, TaxonomyStatus, TaxonomyType } from './taxonomy';

export type Post = typeof post.$inferSelect;
export type NewPost = typeof post.$inferInsert;
export type UpdatePost = Partial<Omit<NewPost, 'id' | 'createdAt'>>;

export enum PostType {
  ARTICLE = 'article',
  PAGE = 'page',
}

export enum PostStatus {
  PUBLISHED = 'published', // published and visible to the public
  PENDING = 'pending', // pending review by admin
  DRAFT = 'draft', // draft and not visible to the public
  ARCHIVED = 'archived', // archived means deleted
}

export async function addPost(data: NewPost) {
  return await addPostRow(data);
}

export async function updatePost(id: string, data: UpdatePost) {
  return await updatePostRow(id, data);
}

export async function deletePost(id: string) {
  const result = await updatePost(id, {
    status: PostStatus.ARCHIVED,
  });

  return result;
}

export async function findPost({
  id,
  slug,
  status,
}: {
  id?: string;
  slug?: string;
  status?: PostStatus;
}) {
  return await findPostRow({ id, slug, status });
}

export async function getPosts({
  type,
  status,
  category,
  tag,
  page = 1,
  limit = 30,
}: {
  type?: PostType;
  status?: PostStatus;
  category?: string;
  tag?: string[];
  page?: number;
  limit?: number;
} = {}): Promise<Post[]> {
  return await getPostRows({ type, status, category, tag, page, limit });
}

export async function getPostsCount({
  type,
  status,
  category,
  tag,
}: {
  type?: PostType;
  status?: PostStatus;
  category?: string;
  tag?: string;
} = {}): Promise<number> {
  return await getPostRowsCount({ type, status, category, tag });
}

// get single post, both from local file and database
// database post has higher priority
export async function getPost({
  slug,
  locale,
  postPrefix = '/blog/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
}): Promise<BlogPostType | null> {
  let post: BlogPostType | null = null;

  try {
    // get post from database
    const postData = await findPost({ slug, status: PostStatus.PUBLISHED });
    if (postData) {
      // post exist in database
      const content = postData.content || '';

      // Generate TOC from content
      const toc = content ? generatePostTocFromMarkdown(content) : undefined;

      post = {
        id: postData.id,
        slug: postData.slug,
        title: postData.title || '',
        description: postData.description || '',
        content,
        body: undefined,
        toc: toc,
        created_at:
          getPostDate({
            created_at: postData.createdAt.toISOString(),
            locale,
          }) || '',
        author_name: postData.authorName || '',
        author_image: postData.authorImage || '',
        author_role: '',
        url: `${postPrefix}${postData.slug}`,
      };

      return post;
    }
  } catch (e) {
    logger.warn('post: get post from database failed', { slug, error: e });
  }

  // get post from locale file
  const localPost = await getLocalPost({ slug, locale, postPrefix });

  return localPost;
}

export async function getLocalPost({
  slug,
  locale,
  postPrefix = '/blog/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
}): Promise<BlogPostType | null> {
  return await getLocalPostFromContent({ slug, locale, postPrefix });
}

// get local page from: content/pages/*.md
export async function getLocalPage({
  slug,
  locale,
}: {
  slug: string;
  locale: string;
}): Promise<BlogPostType | null> {
  return await getLocalPageFromContent({
    slug,
    locale,
    pagePrefix: `/${locale}/`,
  });
}

// get posts and categories, both from local files and database
export async function getPostsAndCategories({
  page = 1,
  limit = 30,
  locale,
  postPrefix = '/blog/',
  categoryPrefix = '/blog/category/',
}: {
  page?: number;
  limit?: number;
  locale: string;
  postPrefix?: string;
  categoryPrefix?: string;
}) {
  let posts: BlogPostType[] = [];

  // merge posts from both locale and remote, remove duplicates by slug
  // remote posts have higher priority
  const postsMap = new Map<string, BlogPostType>();

  // 1. get local posts
  const { posts: localPosts } = await getLocalPostsAndCategories({
    locale,
    postPrefix,
    categoryPrefix,
  });

  // add local posts to postsMap
  localPosts.forEach((post) => {
    if (post.slug) {
      postsMap.set(post.slug, post);
    }
  });

  // 2. get remote posts
  const {
    posts: remotePosts,
    categories: remoteCategories,
    categoriesCount: remoteCategoriesCount,
  } = await getRemotePostsAndCategories({
    page,
    limit,
    locale,
    postPrefix,
    categoryPrefix,
  });

  // add remote posts to postsMap
  remotePosts.forEach((post) => {
    if (post.slug) {
      postsMap.set(post.slug, post);
    }
  });

  // Convert map to array and sort by created_at desc
  posts = Array.from(postsMap.values()).sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return {
    posts,
    postsCount: posts.length,
    categories: remoteCategories, // todo: merge local categories
    categoriesCount: remoteCategoriesCount, // todo: merge local categories count
  };
}

// get remote posts and categories
export async function getRemotePostsAndCategories({
  page = 1,
  limit = 30,
  locale,
  postPrefix = '/blog/',
  categoryPrefix = '/blog/category/',
}: {
  page?: number;
  limit?: number;
  locale: string;
  postPrefix?: string;
  categoryPrefix?: string;
}) {
  const dbPostsList: BlogPostType[] = [];
  const dbCategoriesList: BlogCategoryType[] = [];

  try {
    // get posts from database
    const dbPosts = await getPosts({
      type: PostType.ARTICLE,
      status: PostStatus.PUBLISHED,
      page,
      limit,
    });

    if (!dbPosts || dbPosts.length === 0) {
      return {
        posts: [],
        postsCount: 0,
        categories: [],
        categoriesCount: 0,
      };
    }

    dbPostsList.push(
      ...dbPosts.map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title || '',
        description: post.description || '',
        author_name: post.authorName || '',
        author_image: post.authorImage || '',
        created_at:
          getPostDate({
            created_at: post.createdAt.toISOString(),
            locale,
          }) || '',
        image: post.image || '',
        url: `${postPrefix}${post.slug}`,
      }))
    );

    // get categories from database
    const dbCategories = await getTaxonomies({
      type: TaxonomyType.CATEGORY,
      status: TaxonomyStatus.PUBLISHED,
    });

    dbCategoriesList.push(
      ...(dbCategories || []).map((category) => ({
        id: category.id,
        slug: category.slug,
        title: category.title,
        url: `${categoryPrefix}${category.slug}`,
      }))
    );
  } catch (e) {
    logger.warn('post: get remote posts and categories failed', { error: e });
  }

  return {
    posts: dbPostsList,
    postsCount: dbPostsList.length,
    categories: dbCategoriesList,
    categoriesCount: dbCategoriesList.length,
  };
}

// get local posts and categories
export async function getLocalPostsAndCategories({
  locale,
  postPrefix = '/blog/',
  categoryPrefix = '/blog/category/',
}: {
  locale: string;
  postPrefix?: string;
  categoryPrefix?: string;
}) {
  const result = await getLocalPostsAndCategoriesFromContent({
    locale,
    postPrefix,
    categoryPrefix,
  });

  return {
    posts: result.posts,
    postsCount: result.postsCount,
    categories: result.categories,
    categoriesCount: result.categoriesCount,
  };
}

// Helper function to replace slug for local posts
export function getPostSlug({
  url,
  locale,
  prefix = '/blog/',
}: {
  url: string; // post url, like: /zh/blog/what-is-xxx
  locale: string; // locale
  prefix?: string; // post slug prefix
}): string {
  if (url.startsWith(prefix)) {
    return url.replace(prefix, '');
  } else if (url.startsWith(`/${locale}${prefix}`)) {
    return url.replace(`/${locale}${prefix}`, '');
  }

  return url;
}

export function getPostDate({
  created_at,
  locale,
}: {
  created_at: string;
  locale?: string;
}) {
  // Compatibility wrapper: keep existing export stable, use a single formatter.
  return formatPostDate(created_at, locale);
}

// Helper function to remove frontmatter from markdown content
export function removePostFrontmatter(content: string): string {
  // Match frontmatter pattern: ---\n...content...\n---
  const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
  return content.replace(frontmatterRegex, '').trim();
}
