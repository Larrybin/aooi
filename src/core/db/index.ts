import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { assertRoleDeletedAtColumnExists } from '@/core/db/schema-check';
import { serverEnv } from '@/config/server';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { tryGetCloudflareWorkersEnv } from '@/shared/lib/cloudflare-workers-env.server';
import { isCloudflareWorker } from '@/shared/lib/env';
import { logger } from '@/shared/lib/logger.server';

const SCHEMA_CHECK_RETRY_COOLDOWN_MS = 1000;

type SchemaCheckState = {
  promise: Promise<void> | null;
  lastFailureAt: number | null;
  lastError: Error | null;
};

type CachedDb = {
  drizzle: ReturnType<typeof drizzle>;
  client: ReturnType<typeof postgres>;
};

// Global database connection instance (singleton pattern)
let dbInstance: ReturnType<typeof drizzle> | null = null;
let singletonClient: ReturnType<typeof postgres> | null = null;

const schemaCheckStateByUrl = new Map<string, SchemaCheckState>();
const serverlessCache = new Map<string, CachedDb>();
const workersCache = new Map<string, CachedDb>();

let hasLoggedEnvironment = false;
function getOrCreateSchemaCheckPromise(
  sql: ReturnType<typeof postgres>,
  databaseUrl: string
) {
  const state =
    schemaCheckStateByUrl.get(databaseUrl) ??
    ({
      promise: null,
      lastError: null,
      lastFailureAt: null,
    } as SchemaCheckState);

  if (state.promise) {
    return state.promise;
  }

  const now = Date.now();
  if (
    state.lastFailureAt &&
    now - state.lastFailureAt < SCHEMA_CHECK_RETRY_COOLDOWN_MS
  ) {
    const cooldownPromise = Promise.reject(
      state.lastError ?? new Error('database schema check cooling down')
    );
    cooldownPromise.catch(() => undefined);
    return cooldownPromise;
  }

  const promise = assertRoleDeletedAtColumnExists({
    sql,
    isProduction: process.env.NODE_ENV === 'production',
    logger,
  })
    .then(() => {
      state.lastError = null;
      state.lastFailureAt = null;
    })
    .catch((error: unknown) => {
      state.lastFailureAt = Date.now();
      state.lastError =
        error instanceof Error ? error : new Error(String(error));
      state.promise = null;
      throw state.lastError;
    });

  state.promise = promise;
  schemaCheckStateByUrl.set(databaseUrl, state);
  state.promise.catch(() => undefined);
  return state.promise;
}

function createSchemaCheckedClient(
  sql: ReturnType<typeof postgres>,
  getSchemaReady: () => Promise<void>
): ReturnType<typeof postgres> {
  // Why query-time schema gating?
  // - `src/instrumentation.ts` runs a best-effort startup check in production (Node runtime only, non-blocking).
  // - In serverless/Workers, startup hooks may not run (or may race), and transient DB failures should self-heal.
  // - We gate all queries on the latest schema check (cached with cooldown) so correctness does not depend on a
  //   successful process start and so a single transient failure won't require a full restart.
  function waitForSchema(): Promise<void> {
    try {
      return getSchemaReady();
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  function wrapQuery<T extends object>(query: T): T {
    return new Proxy(query, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);

        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return typeof value === 'function'
            ? (...args: unknown[]) =>
                waitForSchema().then(() =>
                  Reflect.apply(
                    value as (...args: unknown[]) => unknown,
                    target,
                    args
                  )
                )
            : value;
        }

        if (typeof value === 'function') {
          return (...args: unknown[]) =>
            waitForSchema().then(() =>
              Reflect.apply(
                value as (...args: unknown[]) => unknown,
                target,
                args
              )
            );
        }

        return value;
      },
    });
  }

  const proxy = new Proxy(sql, {
    apply(target, thisArg, argArray) {
      const query = Reflect.apply(target, thisArg, argArray) as object;
      return wrapQuery(query);
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;

      if (prop === 'end') {
        return typeof value === 'function'
          ? (...args: unknown[]) =>
              Reflect.apply(value, target, args) as unknown
          : value;
      }

      if (prop === 'unsafe') {
        return typeof value === 'function'
          ? (...args: unknown[]) => {
              const query = Reflect.apply(value, target, args) as object;
              return wrapQuery(query as object);
            }
          : value;
      }

      if (typeof value === 'function') {
        return (...args: unknown[]) =>
          waitForSchema().then(
            () => Reflect.apply(value, target, args) as unknown
          );
      }

      return value;
    },
  });

  return proxy as ReturnType<typeof postgres>;
}

function logEnvironmentOnce(message: string) {
  if (hasLoggedEnvironment) return;
  logger.info(message);
  hasLoggedEnvironment = true;
}

function getOrCreateCachedDb(
  databaseUrl: string,
  options: Parameters<typeof postgres>[1],
  cache: Map<string, CachedDb>
): ReturnType<typeof drizzle> {
  const cached = cache.get(databaseUrl);
  if (cached) {
    return cached.drizzle;
  }

  const rawClient = postgres(databaseUrl, options);
  const checkedClient = createSchemaCheckedClient(rawClient, () =>
    getOrCreateSchemaCheckPromise(rawClient, databaseUrl)
  );
  const drizzleClient = drizzle(checkedClient);
  cache.set(databaseUrl, { drizzle: drizzleClient, client: rawClient });
  return drizzleClient;
}

export function db() {
  let databaseUrl = serverEnv.databaseUrl;

  const cloudflareEnv = tryGetCloudflareWorkersEnv();
  const hasCloudflareWorkersEnv = cloudflareEnv !== null;
  const runningInCloudflareWorkers =
    hasCloudflareWorkersEnv || isCloudflareWorker;
  const publicUnavailableMessage = 'database temporarily unavailable';

  if (runningInCloudflareWorkers) {
    if (!hasCloudflareWorkersEnv) {
      logger.error('db: detected Cloudflare Workers but bindings env missing', {
        hint: 'enable nodejs_compat and ensure cloudflare:workers module is available',
      });
      throw new ServiceUnavailableError(
        'Detected Cloudflare Workers environment but failed to access bindings env via "cloudflare:workers". Ensure your Worker enables `nodejs_compat` and supports the `cloudflare:workers` module.',
        undefined,
        { publicMessage: publicUnavailableMessage }
      );
    }

    const hyperdriveConnectionString =
      cloudflareEnv?.HYPERDRIVE?.connectionString;

    if (!hyperdriveConnectionString) {
      logger.error('db: missing Hyperdrive binding "HYPERDRIVE"', {
        hint: 'configure [[hyperdrive]] binding = "HYPERDRIVE" in wrangler.toml',
      });
      throw new ServiceUnavailableError(
        'Cloudflare Workers requires Hyperdrive binding "HYPERDRIVE" with a valid connectionString. Configure it in your wrangler.toml as: [[hyperdrive]] binding = "HYPERDRIVE".',
        undefined,
        { publicMessage: publicUnavailableMessage }
      );
    }

    databaseUrl = hyperdriveConnectionString;
    logEnvironmentOnce('db: using Hyperdrive connection (Cloudflare Workers)');
  }

  if (!databaseUrl) {
    throw new ServiceUnavailableError('DATABASE_URL is not set', undefined, {
      publicMessage: publicUnavailableMessage,
    });
  }

  // Cloudflare Workers: reuse cached single-connection client per binding
  if (runningInCloudflareWorkers) {
    return getOrCreateCachedDb(
      databaseUrl,
      {
        prepare: false,
        max: 1, // Limit to 1 connection in Workers
        idle_timeout: 10, // Shorter timeout for Workers
        connect_timeout: 5,
      },
      workersCache
    );
  }

  // Singleton mode: reuse existing connection (good for traditional servers)
  if (serverEnv.dbSingletonEnabled === 'true') {
    // Return existing instance if already initialized
    if (dbInstance) {
      return dbInstance;
    }

    // Create connection pool only once
    const client = postgres(databaseUrl, {
      prepare: false,
      max: 10, // Maximum connections in pool
      idle_timeout: 30, // Idle connection timeout (seconds)
      connect_timeout: 10, // Connection timeout (seconds)
    });

    const checkedClient = createSchemaCheckedClient(client, () =>
      getOrCreateSchemaCheckPromise(client, databaseUrl)
    );
    dbInstance = drizzle(checkedClient);
    singletonClient = client;
    logEnvironmentOnce('db: using singleton connection pool');
    return dbInstance;
  }

  // Non-singleton mode: cache single-connection client per database URL
  logEnvironmentOnce('db: using cached single-connection client');
  return getOrCreateCachedDb(
    databaseUrl,
    {
      prepare: false,
      max: 1, // Use single connection in serverless
      idle_timeout: 20,
      connect_timeout: 10,
    },
    serverlessCache
  );
}

async function closeCachedClients(cache: Map<string, CachedDb>) {
  await Promise.all(
    [...cache.values()].map(async (entry) => {
      await entry.client.end();
    })
  );
  cache.clear();
}

// Optional: Function to close database connection (useful for testing or graceful shutdown)
export async function closeDb() {
  if (singletonClient) {
    await singletonClient.end();
    singletonClient = null;
    dbInstance = null;
  }

  await closeCachedClients(serverlessCache);
  await closeCachedClients(workersCache);
  schemaCheckStateByUrl.clear();
}
