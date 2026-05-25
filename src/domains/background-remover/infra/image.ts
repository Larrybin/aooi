import 'server-only';

import type { ProductOwner } from '@/domains/product-access/domain/ownership';
import { db } from '@/infra/adapters/db';
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';

import { backgroundRemoverImage } from '@/config/db/schema';

export type BackgroundRemoverImage = typeof backgroundRemoverImage.$inferSelect;
export type NewBackgroundRemoverImage =
  typeof backgroundRemoverImage.$inferInsert;

function ownerCondition(owner: ProductOwner) {
  return owner.userId
    ? eq(backgroundRemoverImage.userId, owner.userId)
    : and(
        isNull(backgroundRemoverImage.userId),
        owner.anonymousSessionId
          ? eq(
              backgroundRemoverImage.anonymousSessionId,
              owner.anonymousSessionId
            )
          : isNull(backgroundRemoverImage.anonymousSessionId)
      );
}

export async function createBackgroundRemoverImage(
  input: NewBackgroundRemoverImage
) {
  const [image] = await db()
    .insert(backgroundRemoverImage)
    .values(input)
    .returning();
  return image;
}

export async function findBackgroundRemoverImageByIdForOwner({
  id,
  owner,
}: {
  id: string;
  owner: ProductOwner;
}) {
  const [image] = await db()
    .select()
    .from(backgroundRemoverImage)
    .where(
      and(
        eq(backgroundRemoverImage.id, id),
        eq(backgroundRemoverImage.status, 'active'),
        isNull(backgroundRemoverImage.deletedAt),
        ownerCondition(owner)
      )
    )
    .limit(1);

  return image;
}

export async function listExpiredBackgroundRemoverImages({
  now,
  limit = 100,
}: {
  now: Date;
  limit?: number;
}) {
  return db()
    .select()
    .from(backgroundRemoverImage)
    .where(
      and(
        eq(backgroundRemoverImage.status, 'active'),
        isNull(backgroundRemoverImage.deletedAt),
        lte(backgroundRemoverImage.expiresAt, now)
      )
    )
    .limit(limit);
}

export async function markBackgroundRemoverImagesDeletedByIds({
  ids,
  now = new Date(),
}: {
  ids: string[];
  now?: Date;
}) {
  if (!ids.length) {
    return [];
  }

  return db()
    .update(backgroundRemoverImage)
    .set({ status: 'deleted', deletedAt: now })
    .where(inArray(backgroundRemoverImage.id, ids))
    .returning();
}
