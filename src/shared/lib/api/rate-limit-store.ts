export type RateLimitStateRecord = {
  bucket: string;
  scopeKey: string;
  lastActionAt: number | null;
  windowStartedAt: number | null;
  count: number;
  inflight: number;
  expiresAt: number;
};

export type LockedRateLimitStore = {
  get(scopeKey: string): Promise<RateLimitStateRecord | null>;
  getMany(scopeKeys: string[]): Promise<Map<string, RateLimitStateRecord>>;
  set(record: RateLimitStateRecord): Promise<void>;
  delete(scopeKey: string): Promise<void>;
  deleteExpired(now: number): Promise<void>;
};

export type RateLimitStore = {
  withLock<T>(
    bucket: string,
    scopeKeys: string[],
    fn: (store: LockedRateLimitStore) => Promise<T>
  ): Promise<T>;
};

function normalizeScopeKeys(scopeKeys: string[]): string[] {
  return [...new Set(scopeKeys.map((key) => key.trim()).filter(Boolean))].sort();
}

export function createMemoryRateLimitStore(): RateLimitStore {
  const records = new Map<string, RateLimitStateRecord>();

  function buildKey(bucket: string, scopeKey: string) {
    return `${bucket}:${scopeKey}`;
  }

  return {
    async withLock(bucket, _scopeKeys, fn) {
      const normalizedBucket = bucket.trim();
      const store: LockedRateLimitStore = {
        async get(scopeKey) {
          return records.get(buildKey(normalizedBucket, scopeKey)) || null;
        },

        async getMany(inputScopeKeys) {
          const result = new Map<string, RateLimitStateRecord>();
          for (const scopeKey of normalizeScopeKeys(inputScopeKeys)) {
            const record = records.get(buildKey(normalizedBucket, scopeKey));
            if (record) {
              result.set(scopeKey, { ...record });
            }
          }
          return result;
        },

        async set(record) {
          records.set(buildKey(normalizedBucket, record.scopeKey), {
            ...record,
            bucket: normalizedBucket,
          });
        },

        async delete(scopeKey) {
          records.delete(buildKey(normalizedBucket, scopeKey));
        },

        async deleteExpired(now) {
          for (const [key, record] of records.entries()) {
            if (record.bucket !== normalizedBucket) continue;
            if (record.expiresAt <= now) {
              records.delete(key);
            }
          }
        },
      };

      return fn(store);
    },
  };
}
