import { cleanupExpiringMap } from '@/shared/lib/map-cleanup';

export type DeniedLimitResult = {
  allowed: false;
  retryAfterSeconds?: number;
  reason?: string;
};

export type AllowedLimitResult = {
  allowed: true;
};

export type LimitResult = AllowedLimitResult | DeniedLimitResult;

export class CooldownLimiter {
  private readonly lastActionAtByKey = new Map<string, number>();
  private cleanupTick = 0;

  constructor(
    private readonly config: {
      minIntervalMs: number;
      ttlMs: number;
      maxEntries: number;
      cleanupEvery?: number;
      now?: () => number;
    }
  ) {}

  check(key: string, now = this.getNow()): LimitResult {
    this.maybeCleanup(now);

    const lastActionAt = this.lastActionAtByKey.get(key);
    if (!lastActionAt || now - lastActionAt >= this.config.minIntervalMs) {
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(
        (this.config.minIntervalMs - (now - lastActionAt)) / 1000
      ),
    };
  }

  checkAndConsume(key: string, now = this.getNow()): LimitResult {
    const result = this.check(key, now);
    if (result.allowed) {
      this.lastActionAtByKey.set(key, now);
    }
    return result;
  }

  consume(key: string, now = this.getNow()): number {
    this.maybeCleanup(now);
    this.lastActionAtByKey.set(key, now);
    return now;
  }

  rollback(key: string, consumedAt: number): void {
    if (this.lastActionAtByKey.get(key) === consumedAt) {
      this.lastActionAtByKey.delete(key);
    }
  }

  clear(key: string): void {
    this.lastActionAtByKey.delete(key);
  }

  private maybeCleanup(now: number): void {
    const cleanupEvery = this.config.cleanupEvery ?? 0xff;
    if ((this.cleanupTick++ & cleanupEvery) !== 0) return;

    cleanupExpiringMap({
      map: this.lastActionAtByKey,
      now,
      ttlMs: this.config.ttlMs,
      maxEntries: this.config.maxEntries,
      getTimestamp: (lastActionAt) => lastActionAt,
    });
  }

  private getNow(): number {
    return (this.config.now ?? Date.now)();
  }
}

export class FixedWindowAttemptLimiter {
  private readonly attemptsByKey = new Map<
    string,
    { count: number; firstAt: number }
  >();
  private cleanupTick = 0;

  constructor(
    private readonly config: {
      windowMs: number;
      maxAttempts: number;
      maxEntries: number;
      cleanupEvery?: number;
      now?: () => number;
    }
  ) {}

  check(key: string, now = this.getNow()): LimitResult {
    this.maybeCleanup(now);

    const current = this.attemptsByKey.get(key);
    if (!current) return { allowed: true };

    if (now - current.firstAt > this.config.windowMs) {
      return { allowed: true };
    }

    if (current.count < this.config.maxAttempts) {
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((this.config.windowMs - (now - current.firstAt)) / 1000)
      ),
    };
  }

  recordFailure(
    key: string,
    now = this.getNow()
  ): { attempts: number; retryAfterSeconds?: number } {
    this.maybeCleanup(now);

    const current = this.attemptsByKey.get(key);
    if (!current || now - current.firstAt > this.config.windowMs) {
      this.attemptsByKey.set(key, { count: 1, firstAt: now });
      return { attempts: 1 };
    }

    const next = { count: current.count + 1, firstAt: current.firstAt };
    this.attemptsByKey.set(key, next);

    if (next.count < this.config.maxAttempts) {
      return { attempts: next.count };
    }

    return {
      attempts: next.count,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((this.config.windowMs - (now - next.firstAt)) / 1000)
      ),
    };
  }

  clear(key: string): void {
    this.attemptsByKey.delete(key);
  }

  private maybeCleanup(now: number): void {
    const cleanupEvery = this.config.cleanupEvery ?? 0xff;
    if ((this.cleanupTick++ & cleanupEvery) !== 0) return;

    cleanupExpiringMap({
      map: this.attemptsByKey,
      now,
      ttlMs: this.config.windowMs,
      maxEntries: this.config.maxEntries,
      getTimestamp: (entry) => entry.firstAt,
    });
  }

  private getNow(): number {
    return (this.config.now ?? Date.now)();
  }
}

type FixedWindowQuotaState = {
  windowStartedAt: number;
  count: number;
  inflight: number;
};

export class FixedWindowQuotaLimiter {
  private readonly stateByKey = new Map<string, FixedWindowQuotaState>();
  private cleanupTick = 0;

  constructor(
    private readonly config: {
      windowMs: number;
      maxAttempts: number;
      maxConcurrent: number;
      maxEntries: number;
      cleanupEvery?: number;
      now?: () => number;
    }
  ) {}

  acquire(
    key: string,
    now = this.getNow()
  ): AllowedLimitResult | DeniedLimitResult {
    this.maybeCleanup(now);

    const existing = this.stateByKey.get(key);
    const state: FixedWindowQuotaState = existing
      ? { ...existing }
      : { windowStartedAt: now, count: 0, inflight: 0 };

    if (now - state.windowStartedAt > this.config.windowMs) {
      state.windowStartedAt = now;
      state.count = 0;
      state.inflight = 0;
    }

    if (state.count >= this.config.maxAttempts) {
      return { allowed: false, reason: 'rate_limited' };
    }

    if (state.inflight >= this.config.maxConcurrent) {
      return { allowed: false, reason: 'concurrency_limit' };
    }

    state.count += 1;
    state.inflight += 1;
    this.stateByKey.set(key, state);
    return { allowed: true };
  }

  release(key: string): void {
    const state = this.stateByKey.get(key);
    if (!state) return;

    state.inflight = Math.max(0, state.inflight - 1);
    this.stateByKey.set(key, state);
  }

  private maybeCleanup(now: number): void {
    const cleanupEvery = this.config.cleanupEvery ?? 0xff;
    if ((this.cleanupTick++ & cleanupEvery) !== 0) return;

    cleanupExpiringMap({
      map: this.stateByKey,
      now,
      ttlMs: this.config.windowMs,
      maxEntries: this.config.maxEntries,
      getTimestamp: (state) => state.windowStartedAt,
    });
  }

  private getNow(): number {
    return (this.config.now ?? Date.now)();
  }
}

export class DualConcurrencyLimiter {
  private inflightGlobal = 0;
  private readonly inflightByKey = new Map<string, number>();

  constructor(
    private readonly config: {
      maxGlobal: number;
      maxPerKey: number;
    }
  ) {}

  acquire(key: string): boolean {
    if (this.inflightGlobal >= this.config.maxGlobal) {
      return false;
    }

    const currentByKey = this.inflightByKey.get(key) || 0;
    if (currentByKey >= this.config.maxPerKey) {
      return false;
    }

    this.inflightGlobal += 1;
    this.inflightByKey.set(key, currentByKey + 1);
    return true;
  }

  release(key: string): void {
    this.inflightGlobal = Math.max(0, this.inflightGlobal - 1);

    const currentByKey = this.inflightByKey.get(key) || 0;
    if (currentByKey <= 1) {
      this.inflightByKey.delete(key);
      return;
    }

    this.inflightByKey.set(key, currentByKey - 1);
  }
}
