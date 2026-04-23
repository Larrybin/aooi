import '@/config/load-dotenv';

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function readWranglerLocalConnectionString(content: string) {
  const match = content.match(
    /\[\[hyperdrive\]\][\s\S]*?^\s*localConnectionString\s*=\s*"([^"\n]+)"/m
  );
  return match?.[1]?.trim() || null;
}

function resolveCliDatabaseUrl() {
  const explicitDatabaseUrl =
    process.env.AUTH_SPIKE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (explicitDatabaseUrl) {
    return explicitDatabaseUrl;
  }

  const wranglerConfigPath =
    process.env.CF_LOCAL_WRANGLER_CONFIG_PATH?.trim() || '';

  try {
    if (!wranglerConfigPath) {
      throw new Error('missing generated local wrangler config path');
    }
    const wranglerContent = readFileSync(wranglerConfigPath, 'utf8');
    const localConnectionString =
      readWranglerLocalConnectionString(wranglerContent);
    if (localConnectionString) {
      return localConnectionString;
    }
  } catch {
    // fall through to the canonical error below
  }

  throw new Error(
    'DATABASE_URL is required; if you rely on Cloudflare local DB wiring, point CF_LOCAL_WRANGLER_CONFIG_PATH at the generated temporary local Wrangler config with [[hyperdrive]].localConnectionString'
  );
}

export function createCliDb() {
  const databaseUrl = resolveCliDatabaseUrl();

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
  });

  return {
    db: drizzle(client),
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
