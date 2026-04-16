import 'server-only';

import { and, eq, inArray, lte, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { apiRateLimitState } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import type {
  LockedRateLimitStore,
  RateLimitStateRecord,
  RateLimitStore,
} from '@/shared/lib/api/rate-limit-store';

type DbClient = ReturnType<typeof db>;
type DbTx = Parameters<Parameters<DbClient['transaction']>[0]>[0];

function toMillis(value: Date | null | undefined): number | null {
  if (!value) return null;
  const millis = value.getTime();
  return Number.isNaN(millis) ? null : millis;
}

function normalizeScopeKeys(scopeKeys: string[]): string[] {
  return [...new Set(scopeKeys.map((key) => key.trim()).filter(Boolean))].sort();
}

function toStateRecord(
  row: typeof apiRateLimitState.$inferSelect
): RateLimitStateRecord {
  return {
    bucket: row.bucket,
    scopeKey: row.scopeKey,
    lastActionAt: toMillis(row.lastActionAt),
    windowStartedAt: toMillis(row.windowStartedAt),
    count: row.count,
    inflight: row.inflight,
    expiresAt: row.expiresAt.getTime(),
  };
}

function toStateInsert(record: RateLimitStateRecord) {
  return {
    id: getUuid(),
    bucket: record.bucket,
    scopeKey: record.scopeKey,
    lastActionAt:
      typeof record.lastActionAt === 'number'
        ? new Date(record.lastActionAt)
        : null,
    windowStartedAt:
      typeof record.windowStartedAt === 'number'
        ? new Date(record.windowStartedAt)
        : null,
    count: record.count,
    inflight: record.inflight,
    expiresAt: new Date(record.expiresAt),
  };
}

function createDbLockedStore(tx: DbTx, bucket: string): LockedRateLimitStore {
  return {
    async get(scopeKey) {
      const [row] = await tx
        .select()
        .from(apiRateLimitState)
        .where(
          and(
            eq(apiRateLimitState.bucket, bucket),
            eq(apiRateLimitState.scopeKey, scopeKey)
          )
        );

      return row ? toStateRecord(row) : null;
    },

    async getMany(scopeKeys) {
      const normalized = normalizeScopeKeys(scopeKeys);
      if (normalized.length === 0) {
        return new Map<string, RateLimitStateRecord>();
      }

      const rows = await tx
        .select()
        .from(apiRateLimitState)
        .where(
          and(
            eq(apiRateLimitState.bucket, bucket),
            inArray(apiRateLimitState.scopeKey, normalized)
          )
        );

      return new Map(
        rows.map((row) => [row.scopeKey, toStateRecord(row)] as const)
      );
    },

    async set(record) {
      const [existing] = await tx
        .select({ id: apiRateLimitState.id })
        .from(apiRateLimitState)
        .where(
          and(
            eq(apiRateLimitState.bucket, bucket),
            eq(apiRateLimitState.scopeKey, record.scopeKey)
          )
        );

      if (!existing) {
        await tx.insert(apiRateLimitState).values(toStateInsert(record));
        return;
      }

      await tx
        .update(apiRateLimitState)
        .set({
          lastActionAt:
            typeof record.lastActionAt === 'number'
              ? new Date(record.lastActionAt)
              : null,
          windowStartedAt:
            typeof record.windowStartedAt === 'number'
              ? new Date(record.windowStartedAt)
              : null,
          count: record.count,
          inflight: record.inflight,
          expiresAt: new Date(record.expiresAt),
          updatedAt: new Date(),
        })
        .where(eq(apiRateLimitState.id, existing.id));
    },

    async delete(scopeKey) {
      await tx
        .delete(apiRateLimitState)
        .where(
          and(
            eq(apiRateLimitState.bucket, bucket),
            eq(apiRateLimitState.scopeKey, scopeKey)
          )
        );
    },

    async deleteExpired(now) {
      await tx
        .delete(apiRateLimitState)
        .where(
          and(
            eq(apiRateLimitState.bucket, bucket),
            lte(apiRateLimitState.expiresAt, new Date(now))
          )
        );
    },
  };
}

async function lockScopeKeys(tx: DbTx, bucket: string, scopeKeys: string[]) {
  for (const scopeKey of normalizeScopeKeys(scopeKeys)) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${bucket}), hashtext(${scopeKey}))`
    );
  }
}

export function createDbRateLimitStore(): RateLimitStore {
  return {
    async withLock(bucket, scopeKeys, fn) {
      return db().transaction(async (tx) => {
        await lockScopeKeys(tx, bucket, scopeKeys);
        return fn(createDbLockedStore(tx, bucket));
      });
    },
  };
}
