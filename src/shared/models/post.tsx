import 'server-only';

import type { post } from '@/config/db/schema';
import { logger } from '@/shared/lib/logger.server';
import { formatPostDate } from '@/shared/lib/post-date';
import { buildPostTocFromMarkdown } from '@/shared/lib/post-toc';
import type { Post as BlogPostType } from '@/shared/types/blocks/blog';

import {
  addPostRow,
  findPostRow,
  getPostRows,
  getPostRowsCount,
  updatePostRow,
} from './post_repo';

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

export async function getPost({
  slug,
  locale,
  postPrefix = '/blog/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
}): Promise<BlogPostType | null> {
  try {
    const postData = await findPost({ slug, status: PostStatus.PUBLISHED });
    if (postData) {
      const content = postData.content || '';
      return {
        id: postData.id,
        slug: postData.slug,
        title: postData.title || '',
        description: postData.description || '',
        content,
        body: undefined,
        toc: content ? buildPostTocFromMarkdown(content) : undefined,
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
    }
  } catch (e) {
    logger.warn('post: get post from database failed', { slug, error: e });
  }

  return null;
}

function getPostDate({
  created_at,
  locale,
}: {
  created_at: string;
  locale?: string;
}) {
  return formatPostDate(created_at, locale);
}
