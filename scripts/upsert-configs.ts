import '@/config/load-dotenv';

import { sql } from 'drizzle-orm';

import { config } from '@/config/db/schema';

import { createCliDb } from './lib/cli-db';

function parseConfigArgs(args: string[]) {
  const configs: Record<string, string> = {};

  for (const arg of args) {
    if (!arg.startsWith('--set=')) {
      continue;
    }

    const assignment = arg.slice('--set='.length);
    const separatorIndex = assignment.indexOf('=');
    if (separatorIndex <= 0) {
      throw new Error(`invalid --set argument: ${arg}`);
    }

    const name = assignment.slice(0, separatorIndex).trim();
    const value = assignment.slice(separatorIndex + 1);
    if (!name) {
      throw new Error(`invalid config name in argument: ${arg}`);
    }

    configs[name] = value;
  }

  return configs;
}

async function main() {
  const configs = parseConfigArgs(process.argv.slice(2));
  if (Object.keys(configs).length === 0) {
    throw new Error('at least one --set=<name>=<value> argument is required');
  }

  const { db, close } = createCliDb();

  try {
    await db
      .insert(config)
      .values(
        Object.entries(configs).map(([name, value]) => ({
          name,
          value,
        }))
      )
      .onConflictDoUpdate({
        target: config.name,
        set: { value: sql`excluded.value` },
      });
  } finally {
    await close();
  }

  console.log(`upserted configs: ${Object.keys(configs).join(', ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
