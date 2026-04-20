import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const trackedTypesPath = path.resolve(rootDir, 'src/shared/types/cloudflare.d.ts');

function runWranglerTypes() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      [
        'exec',
        'wrangler',
        'types',
        '--config',
        'wrangler.cloudflare.toml',
        '--env-interface',
        'CloudflareEnv',
        trackedTypesPath,
      ],
      {
        cwd: rootDir,
        env: process.env,
        stdio: 'inherit',
      }
    );

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`wrangler types exited with code ${code}`));
        return;
      }

      resolve(undefined);
    });
  });
}

async function main() {
  const before = await readFile(trackedTypesPath, 'utf8');
  await runWranglerTypes();
  const after = await readFile(trackedTypesPath, 'utf8');

  if (before !== after) {
    throw new Error(
      'src/shared/types/cloudflare.d.ts is out of date. Run `pnpm cf:typegen` and commit the result.'
    );
  }

  console.log('[cf:typegen:check] src/shared/types/cloudflare.d.ts is up to date');
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
