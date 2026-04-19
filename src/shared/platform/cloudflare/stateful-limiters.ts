import type {
  AllowedLimitResult,
  DeniedLimitResult,
  LimitResult,
} from '@/shared/lib/api/limiters';
import { getCloudflareBindings } from '@/shared/lib/runtime/env.server';

type CooldownConfig = {
  bucket: string;
  minIntervalMs: number;
  ttlMs: number;
};

type AttemptConfig = {
  bucket: string;
  windowMs: number;
  maxAttempts: number;
};

type QuotaConfig = {
  bucket: string;
  windowMs: number;
  maxAttempts: number;
  maxConcurrent: number;
};

type DualConfig = {
  bucket: string;
  maxGlobal: number;
  maxPerKey: number;
  leaseMs: number;
};

const BUCKET_SCOPED_OBJECT_PREFIX = 'bucket';
const KEY_SCOPED_OBJECT_PREFIX = 'scope';

export function buildStatefulLimiterObjectName(
  bucket: string,
  key?: string
): string {
  return key
    ? `${KEY_SCOPED_OBJECT_PREFIX}:${bucket}:${key}`
    : `${BUCKET_SCOPED_OBJECT_PREFIX}:${bucket}`;
}

async function callStatefulLimiter<T>(
  bucket: string,
  body: Record<string, unknown>,
  options: {
    key?: string;
  } = {}
): Promise<T> {
  const namespace = getCloudflareBindings()?.STATEFUL_LIMITERS as
    | DurableObjectNamespace
    | undefined;
  if (!namespace) {
    throw new Error('STATEFUL_LIMITERS binding is missing');
  }

  const id = namespace.idFromName(
    buildStatefulLimiterObjectName(bucket, options.key)
  );
  const stub = namespace.get(id);
  const response = await stub.fetch('https://stateful-limiters.internal', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      bucket,
      ...body,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `stateful limiter request failed (${response.status} ${response.statusText})`
    );
  }

  return (await response.json()) as T;
}

export class CloudflareCooldownLimiter {
  constructor(
    private readonly config: CooldownConfig,
    private readonly now: () => number = Date.now
  ) {}

  async check(key: string, now = this.now()): Promise<LimitResult> {
    return await callStatefulLimiter<LimitResult>(this.config.bucket, {
      action: 'cooldown.check',
      key,
      now,
      config: this.config,
    }, { key });
  }

  async checkAndConsume(key: string, now = this.now()): Promise<LimitResult> {
    return await callStatefulLimiter<LimitResult>(this.config.bucket, {
      action: 'cooldown.checkAndConsume',
      key,
      now,
      config: this.config,
    }, { key });
  }

  async consume(key: string, now = this.now()): Promise<number> {
    return await callStatefulLimiter<number>(this.config.bucket, {
      action: 'cooldown.consume',
      key,
      now,
      config: this.config,
    }, { key });
  }

  async rollback(key: string, consumedAt: number): Promise<void> {
    await callStatefulLimiter(this.config.bucket, {
      action: 'cooldown.rollback',
      key,
      consumedAt,
      config: this.config,
    }, { key });
  }

  async clear(key: string): Promise<void> {
    await callStatefulLimiter(this.config.bucket, {
      action: 'cooldown.clear',
      key,
      config: this.config,
    }, { key });
  }
}

export class CloudflareAttemptLimiter {
  constructor(
    private readonly config: AttemptConfig,
    private readonly now: () => number = Date.now
  ) {}

  async check(key: string, now = this.now()): Promise<LimitResult> {
    return await callStatefulLimiter<LimitResult>(this.config.bucket, {
      action: 'attempt.check',
      key,
      now,
      config: this.config,
    }, { key });
  }

  async recordFailure(
    key: string,
    now = this.now()
  ): Promise<{ attempts: number; retryAfterSeconds?: number }> {
    return await callStatefulLimiter(this.config.bucket, {
      action: 'attempt.recordFailure',
      key,
      now,
      config: this.config,
    }, { key });
  }

  async clear(key: string): Promise<void> {
    await callStatefulLimiter(this.config.bucket, {
      action: 'attempt.clear',
      key,
      config: this.config,
    }, { key });
  }
}

export class CloudflareQuotaLimiter {
  constructor(
    private readonly config: QuotaConfig,
    private readonly now: () => number = Date.now
  ) {}

  async acquire(
    key: string,
    now = this.now()
  ): Promise<AllowedLimitResult | DeniedLimitResult> {
    return await callStatefulLimiter(this.config.bucket, {
      action: 'quota.acquire',
      key,
      now,
      config: this.config,
    }, { key });
  }

  async release(key: string, now = this.now()): Promise<void> {
    await callStatefulLimiter(this.config.bucket, {
      action: 'quota.release',
      key,
      now,
      config: this.config,
    }, { key });
  }
}

export class CloudflareDualConcurrencyLimiter {
  constructor(
    private readonly config: DualConfig,
    private readonly now: () => number = Date.now
  ) {}

  async acquire(key: string, now = this.now()): Promise<boolean> {
    return await callStatefulLimiter(this.config.bucket, {
      action: 'dual.acquire',
      key,
      now,
      config: this.config,
    });
  }

  async release(key: string, now = this.now()): Promise<void> {
    await callStatefulLimiter(this.config.bucket, {
      action: 'dual.release',
      key,
      now,
      config: this.config,
    });
  }
}
