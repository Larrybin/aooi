import 'server-only';

import { and, count, desc, eq, like, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { post } from '@/config/db/schema';

export type PostRow = typeof post.$inferSelect;
export type NewPostRow = typeof post.$inferInsert;
export type UpdatePostRow = Partial<Omit<NewPostRow, 'id' | 'createdAt'>>;

export type PostQuery = {
  type?: string;
  status?: string;
  category?: string;
  tag?: string | string[];
  page?: number;
  limit?: number;
};

export async function addPostRow(data: NewPostRow) {
  const [result] = await db().insert(post).values(data).returning();
  return result;
}

export async function updatePostRow(id: string, data: UpdatePostRow) {
  const [result] = await db()
    .update(post)
    .set(data)
    .where(eq(post.id, id))
    .returning();
  return result;
}

export async function findPostRow({
  id,
  slug,
  status,
}: {
  id?: string;
  slug?: string;
  status?: string;
}) {
  const [result] = await db()
    .select()
    .from(post)
    .where(
      and(
        id ? eq(post.id, id) : undefined,
        slug ? eq(post.slug, slug) : undefined,
        status ? eq(post.status, status) : undefined
      )
    )
    .limit(1);

  return result;
}

export async function getPostRows({
  type,
  status,
  category,
  tag,
  page = 1,
  limit = 30,
}: PostQuery = {}): Promise<PostRow[]> {
  const tags = Array.isArray(tag) ? tag : tag ? [tag] : undefined;

  const result = await db()
    .select()
    .from(post)
    .where(
      and(
        type ? eq(post.type, type) : undefined,
        status ? eq(post.status, status) : undefined,
        category ? like(post.categories, `%${category}%`) : undefined,
        tags && tags.length > 0
          ? or(...tags.map((t) => like(post.tags, `%${t}%`)))
          : undefined
      )
    )
    .orderBy(desc(post.updatedAt), desc(post.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return result;
}

export async function getPostRowsCount({
  type,
  status,
  category,
  tag,
}: PostQuery = {}): Promise<number> {
  const tags = Array.isArray(tag) ? tag : tag ? [tag] : undefined;

  const [result] = await db()
    .select({ count: count() })
    .from(post)
    .where(
      and(
        type ? eq(post.type, type) : undefined,
        status ? eq(post.status, status) : undefined,
        category ? like(post.categories, `%${category}%`) : undefined,
        tags && tags.length > 0
          ? or(...tags.map((t) => like(post.tags, `%${t}%`)))
          : undefined
      )
    )
    .limit(1);

  return result?.count || 0;
}
