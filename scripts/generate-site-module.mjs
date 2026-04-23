import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { readCurrentSiteConfig, resolveRequiredSiteKey } from './lib/site-config.mjs';

function toModuleSource(site) {
  return `export const site = ${JSON.stringify(
    site,
    null,
    2
  )} as const;\n`;
}

async function main() {
  const siteKey = resolveRequiredSiteKey(process.env);
  const targetPath = resolve(process.cwd(), '.generated', 'site.ts');
  const site = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey,
  });

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, toModuleSource(site), 'utf8');

  process.stdout.write(`[site] generated ${siteKey}\n`);
}

await main();
