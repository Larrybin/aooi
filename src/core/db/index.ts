import 'server-only';

import { createRequire } from 'node:module';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { assertRoleDeletedAtColumnExists } from '@/core/db/schema-check';
import { serverEnv } from '@/config/server';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { isCloudflareWorker } from '@/shared/lib/env';
import { logger } from '@/shared/lib/logger.server';

// Global database connection instance (singleton pattern)
let dbInstance: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

let schemaCheckPromise: Promise<void> | null = null;
let schemaCheckDatabaseUrl: string | null = null;

function getOrCreateSchemaCheckPromise(
  sql: ReturnType<typeof postgres>,
  databaseUrl: string
) {
  if (schemaCheckPromise && schemaCheckDatabaseUrl === databaseUrl) {
    return schemaCheckPromise;
  }

  schemaCheckDatabaseUrl = databaseUrl;
  schemaCheckPromise = assertRoleDeletedAtColumnExists({
    sql,
    isProduction: process.env.NODE_ENV === 'production',
    logger,
  });
  schemaCheckPromise.catch(() => undefined);
  return schemaCheckPromise;
}

function createSchemaCheckedClient(
  sql: ReturnType<typeof postgres>,
  schemaReady: Promise<void>
): ReturnType<typeof postgres> {
  function wrapQuery<T extends object>(query: T): T {
    return new Proxy(query, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);

        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return typeof value === 'function'
            ? (...args: unknown[]) =>
                schemaReady.then(() =>
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
            schemaReady.then(() =>
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
          schemaReady.then(() => Reflect.apply(value, target, args) as unknown);
      }

      return value;
    },
  });

  return proxy as ReturnType<typeof postgres>;
}

type CloudflareWorkersEnv = {
  HYPERDRIVE?: {
    connectionString?: string;
  };
} & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function tryGetCloudflareWorkersEnv(): CloudflareWorkersEnv | null {
  try {
    const require = createRequire(import.meta.url);
    // Prevent webpack from trying to resolve the `cloudflare:` scheme at build time.
    // This module only exists in Cloudflare Workers runtime (nodejs_compat).
    const workers = require(['cloudflare', 'workers'].join(':')) as unknown;

    if (!isRecord(workers) || !('env' in workers)) {
      return null;
    }

    const env = (workers as { env?: unknown }).env;
    return isRecord(env) ? (env as CloudflareWorkersEnv) : null;
  } catch {
    return null;
  }
}

export function db() {
  let databaseUrl = serverEnv.databaseUrl;

  const cloudflareEnv = tryGetCloudflareWorkersEnv();
  const hasCloudflareWorkersEnv = cloudflareEnv !== null;
  const runningInCloudflareWorkers =
    hasCloudflareWorkersEnv || isCloudflareWorker;

  if (runningInCloudflareWorkers) {
    if (!hasCloudflareWorkersEnv) {
      throw new ServiceUnavailableError(
        'Detected Cloudflare Workers environment but failed to access bindings env via "cloudflare:workers". Ensure your Worker enables `nodejs_compat` and supports the `cloudflare:workers` module.'
      );
    }

    const hyperdriveConnectionString =
      cloudflareEnv?.HYPERDRIVE?.connectionString;

    if (!hyperdriveConnectionString) {
      throw new ServiceUnavailableError(
        'Cloudflare Workers requires Hyperdrive binding "HYPERDRIVE" with a valid connectionString. Configure it in your wrangler.toml (see wrangler.toml.example) as: [[hyperdrive]] binding = "HYPERDRIVE".'
      );
    }

    databaseUrl = hyperdriveConnectionString;
    logger.info('db: using Hyperdrive connection');
  }

  if (!databaseUrl) {
    throw new ServiceUnavailableError('DATABASE_URL is not set');
  }

  // In Cloudflare Workers, create new connection each time
  if (runningInCloudflareWorkers) {
    logger.info('db: in Cloudflare Workers environment');
    // Workers environment uses minimal configuration
    const rawClient = postgres(databaseUrl, {
      prepare: false,
      max: 1, // Limit to 1 connection in Workers
      idle_timeout: 10, // Shorter timeout for Workers
      connect_timeout: 5,
    });

    const schemaReady = getOrCreateSchemaCheckPromise(rawClient, databaseUrl);
    const checkedClient = createSchemaCheckedClient(rawClient, schemaReady);
    return drizzle(checkedClient);
  }

  // Singleton mode: reuse existing connection (good for traditional servers)
  if (serverEnv.dbSingletonEnabled === 'true') {
    // Return existing instance if already initialized
    if (dbInstance) {
      return dbInstance;
    }

    // Create connection pool only once
    client = postgres(databaseUrl, {
      prepare: false,
      max: 10, // Maximum connections in pool
      idle_timeout: 30, // Idle connection timeout (seconds)
      connect_timeout: 10, // Connection timeout (seconds)
    });

    const schemaReady = getOrCreateSchemaCheckPromise(client, databaseUrl);
    const checkedClient = createSchemaCheckedClient(client, schemaReady);
    dbInstance = drizzle(checkedClient);
    return dbInstance;
  }

  // Non-singleton mode: create new connection each time (good for serverless)
  // In serverless, the connection will be cleaned up when the function instance is destroyed
  const serverlessClient = postgres(databaseUrl, {
    prepare: false,
    max: 1, // Use single connection in serverless
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const schemaReady = getOrCreateSchemaCheckPromise(
    serverlessClient,
    databaseUrl
  );
  const checkedClient = createSchemaCheckedClient(
    serverlessClient,
    schemaReady
  );
  return drizzle(checkedClient);
}

// Optional: Function to close database connection (useful for testing or graceful shutdown)
// Note: Only works in singleton mode
export async function closeDb() {
  if (serverEnv.dbSingletonEnabled === 'true' && client) {
    await client.end();
    client = null;
    dbInstance = null;
    schemaCheckPromise = null;
    schemaCheckDatabaseUrl = null;
  }
}
