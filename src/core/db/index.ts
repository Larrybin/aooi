import 'server-only';
import '@/config/load-dotenv';

import { drizzle } from 'drizzle-orm/postgres-js';
import { createRequire } from 'node:module';
import postgres from 'postgres';

import { serverEnv } from '@/config/server';
import { isCloudflareWorker } from '@/shared/lib/env';
import { logger } from '@/shared/lib/logger.server';

// Global database connection instance (singleton pattern)
let dbInstance: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

function tryGetCloudflareWorkersEnv(): any | null {
  try {
    const require = createRequire(import.meta.url);
    const workers = require('cloudflare:workers');
    return workers?.env ?? null;
  } catch {
    return null;
  }
}

export function db() {
  let databaseUrl = serverEnv.databaseUrl;

  const cloudflareEnv = tryGetCloudflareWorkersEnv();
  const hasCloudflareWorkersEnv = cloudflareEnv !== null;
  const runningInCloudflareWorkers = hasCloudflareWorkersEnv || isCloudflareWorker;

  if (runningInCloudflareWorkers) {
    if (!hasCloudflareWorkersEnv) {
      throw new Error(
        'Detected Cloudflare Workers environment but failed to access bindings env via "cloudflare:workers". Ensure your Worker enables `nodejs_compat` and supports the `cloudflare:workers` module.'
      );
    }

    const hyperdriveConnectionString = cloudflareEnv?.HYPERDRIVE?.connectionString;

    if (!hyperdriveConnectionString) {
      throw new Error(
        'Cloudflare Workers requires Hyperdrive binding "HYPERDRIVE" with a valid connectionString. Configure it in your wrangler.toml (see wrangler.toml.example) as: [[hyperdrive]] binding = "HYPERDRIVE".'
      );
    }

    databaseUrl = hyperdriveConnectionString;
    logger.info('db: using Hyperdrive connection');
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  // In Cloudflare Workers, create new connection each time
  if (runningInCloudflareWorkers) {
    logger.info('db: in Cloudflare Workers environment');
    // Workers environment uses minimal configuration
    const client = postgres(databaseUrl, {
      prepare: false,
      max: 1, // Limit to 1 connection in Workers
      idle_timeout: 10, // Shorter timeout for Workers
      connect_timeout: 5,
    });

    return drizzle(client);
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

    dbInstance = drizzle({ client });
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

  return drizzle({ client: serverlessClient });
}

// Optional: Function to close database connection (useful for testing or graceful shutdown)
// Note: Only works in singleton mode
export async function closeDb() {
  if (serverEnv.dbSingletonEnabled === 'true' && client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}
