import 'server-only';

import { and, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { aiTask, credit } from '@/config/db/schema';
import { AITaskStatus } from '@/extensions/ai';
import { safeJsonParse } from '@/shared/lib/json';
import { logger } from '@/shared/lib/logger.server';
import { appendUserToResult, type User } from '@/shared/models/user';

import { consumeCredits, CreditStatus } from './credit';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isConsumedItem(
  value: unknown
): value is { creditId: string; creditsConsumed: number } {
  if (!isRecord(value)) return false;
  return (
    typeof value.creditId === 'string' &&
    typeof value.creditsConsumed === 'number' &&
    value.creditsConsumed > 0
  );
}

export type AITask = typeof aiTask.$inferSelect & {
  user?: User;
};
export type NewAITask = typeof aiTask.$inferInsert;
export type UpdateAITask = Partial<Omit<NewAITask, 'id' | 'createdAt'>>;

export async function createAITask(newAITask: NewAITask) {
  const result = await db().transaction(async (tx) => {
    // 1. create task record
    const [taskResult] = await tx.insert(aiTask).values(newAITask).returning();

    if (newAITask.costCredits && newAITask.costCredits > 0) {
      // 2. consume credits
      const consumedCredit = await consumeCredits({
        userId: newAITask.userId,
        credits: newAITask.costCredits,
        scene: newAITask.scene,
        description: `generate ${newAITask.mediaType}`,
        metadata: JSON.stringify({
          type: 'ai-task',
          mediaType: taskResult.mediaType,
          taskId: taskResult.id,
        }),
      });

      // 3. update task record with consumed credit id
      if (consumedCredit && consumedCredit.id) {
        taskResult.creditId = consumedCredit.id;
        await tx
          .update(aiTask)
          .set({ creditId: consumedCredit.id })
          .where(eq(aiTask.id, taskResult.id));
      }
    }

    return taskResult;
  });

  return result;
}

export async function findAITaskById(id: string) {
  const [result] = await db().select().from(aiTask).where(eq(aiTask.id, id));
  return result;
}

export async function updateAITaskById(id: string, updateAITask: UpdateAITask) {
  const result = await db().transaction(async (tx) => {
    // task failed, Revoke credit consumption record
    if (updateAITask.status === AITaskStatus.FAILED && updateAITask.creditId) {
      // get consumed credit record
      const [consumedCredit] = await tx
        .select()
        .from(credit)
        .where(eq(credit.id, updateAITask.creditId));
      if (consumedCredit && consumedCredit.status === CreditStatus.ACTIVE) {
        const consumedItemsRaw = safeJsonParse<unknown>(
          consumedCredit.consumedDetail
        );
        if (!Array.isArray(consumedItemsRaw) || consumedItemsRaw.length === 0) {
          logger.error('credit: invalid consumedDetail payload, skip refund', {
            aiTaskId: id,
            creditId: updateAITask.creditId,
            credits: consumedCredit.credits,
            consumedDetailLength:
              typeof consumedCredit.consumedDetail === 'string'
                ? consumedCredit.consumedDetail.length
                : 0,
          });
        } else {
          const consumedItems: Array<{
            creditId: string;
            creditsConsumed: number;
          }> = [];
          let hasInvalidItem = false;
          for (const item of consumedItemsRaw) {
            if (!isConsumedItem(item)) {
              hasInvalidItem = true;
              break;
            }
            consumedItems.push(item);
          }

          const expectedCredits = Math.abs(consumedCredit.credits || 0);
          const consumedCreditsTotal = consumedItems.reduce(
            (sum, item) => sum + item.creditsConsumed,
            0
          );

          const canRefund =
            !hasInvalidItem &&
            consumedItems.length === consumedItemsRaw.length &&
            expectedCredits > 0 &&
            consumedCreditsTotal === expectedCredits;

          if (!canRefund) {
            logger.error(
              'credit: invalid consumedDetail payload, skip refund',
              {
                aiTaskId: id,
                creditId: updateAITask.creditId,
                credits: consumedCredit.credits,
                expectedCredits,
                consumedCreditsTotal,
                itemCount: consumedItemsRaw.length,
                validItemCount: consumedItems.length,
              }
            );
          } else {
            await Promise.all(
              consumedItems.map((item) =>
                tx
                  .update(credit)
                  .set({
                    remainingCredits: sql`${credit.remainingCredits} + ${item.creditsConsumed}`,
                  })
                  .where(eq(credit.id, item.creditId))
              )
            );

            // delete consumed credit record (only after refund succeeds)
            await tx
              .update(credit)
              .set({
                status: CreditStatus.DELETED,
              })
              .where(eq(credit.id, updateAITask.creditId));
          }
        }
      }
    }

    // update task
    const [result] = await tx
      .update(aiTask)
      .set(updateAITask)
      .where(eq(aiTask.id, id))
      .returning();

    return result;
  });

  return result;
}

export async function getAITasksCount({
  userId,
  status,
  mediaType,
  provider,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string;
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        status ? eq(aiTask.status, status) : undefined
      )
    );

  return result?.count || 0;
}

export async function getAITasks({
  userId,
  status,
  mediaType,
  provider,
  page = 1,
  limit = 30,
  getUser = false,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string;
  page?: number;
  limit?: number;
  getUser?: boolean;
}): Promise<AITask[]> {
  const result = await db()
    .select()
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        status ? eq(aiTask.status, status) : undefined
      )
    )
    .orderBy(desc(aiTask.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}
