import '@/config/load-dotenv';

import { mergeMissingDefaultSettings } from '@/domains/settings/bootstrap';
import { sql } from 'drizzle-orm';

import { config } from '@/config/db/schema';

import { createCliDb } from './lib/cli-db';
import {
  buildSiteBootstrapSnapshot,
  serializeSiteBootstrapSnapshot,
} from './lib/site-bootstrap.mjs';

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
  const defaults = buildSiteBootstrapSnapshot().settings;

  if (Object.keys(configs).length === 0) {
    process.stdout.write(
      serializeSiteBootstrapSnapshot({ settings: defaults })
    );
    return;
  }

  const { db, close } = createCliDb();

  try {
    const rows = await db.select().from(config);
    const currentConfigs = Object.fromEntries(
      rows.map((entry) => [entry.name, entry.value ?? ''])
    );
    const missingDefaults = mergeMissingDefaultSettings({
      current: currentConfigs,
      defaults,
    });
    const missingDefaultEntries = Object.entries(missingDefaults);

    if (missingDefaultEntries.length > 0) {
      await db
        .insert(config)
        .values(
          missingDefaultEntries.map(([name, value]) => ({
            name,
            value,
          }))
        )
        .onConflictDoNothing({
          target: config.name,
        });
    }

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
