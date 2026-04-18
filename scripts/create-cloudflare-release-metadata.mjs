import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const SCHEMA_PATH = 'src/config/db/schema.ts';
const MIGRATIONS_PREFIX = 'src/config/db/migrations/';

function parseArgs(argv) {
  const options = {
    baseSha: '',
    headSha: '',
    out: path.resolve(rootDir, '.tmp/release-metadata.json'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--base-sha=')) {
      options.baseSha = arg.slice('--base-sha='.length).trim();
      continue;
    }

    if (arg.startsWith('--head-sha=')) {
      options.headSha = arg.slice('--head-sha='.length).trim();
      continue;
    }

    if (arg.startsWith('--out=')) {
      options.out = path.resolve(rootDir, arg.slice('--out='.length));
    }
  }

  if (!options.headSha) {
    throw new Error('--head-sha is required');
  }

  return options;
}

async function resolveBaseSha(baseSha, headSha) {
  if (baseSha && !/^0+$/.test(baseSha)) {
    return baseSha;
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', `${headSha}^1`],
      {
        cwd: rootDir,
      }
    );
    return stdout.trim();
  } catch {
    return EMPTY_TREE_SHA;
  }
}

async function readChangedPaths(baseSha, headSha) {
  const { stdout } = await execFileAsync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACDMRTUXB', baseSha, headSha],
    { cwd: rootDir }
  );

  return stdout
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
}

function buildReleaseMetadata({ baseSha, headSha, changedPaths }) {
  const schemaFileChanged = changedPaths.includes(SCHEMA_PATH);
  const migrationsChanged = changedPaths.some((value) =>
    value.startsWith(MIGRATIONS_PREFIX)
  );

  if (schemaFileChanged && !migrationsChanged) {
    throw new Error(
      `${SCHEMA_PATH} changed without any committed migration in ${MIGRATIONS_PREFIX}`
    );
  }

  return {
    base_sha: baseSha,
    head_sha: headSha,
    schema_changed: schemaFileChanged || migrationsChanged,
    changed_paths: changedPaths,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseSha = await resolveBaseSha(options.baseSha, options.headSha);
  const changedPaths = await readChangedPaths(baseSha, options.headSha);
  const metadata = buildReleaseMetadata({
    baseSha,
    headSha: options.headSha,
    changedPaths,
  });

  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(
    options.out,
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8'
  );

  process.stdout.write(
    `[cloudflare-release] head=${metadata.head_sha} base=${metadata.base_sha} schema_changed=${metadata.schema_changed}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack || error.message : String(error)}\n`
  );
  process.exit(1);
});
