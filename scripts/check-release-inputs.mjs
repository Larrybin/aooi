import { execFile } from 'node:child_process';
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
  };

  for (const arg of argv) {
    if (arg.startsWith('--base-sha=')) {
      options.baseSha = arg.slice('--base-sha='.length).trim();
      continue;
    }

    if (arg.startsWith('--head-sha=')) {
      options.headSha = arg.slice('--head-sha='.length).trim();
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

export async function readChangedPaths({ baseSha, headSha }) {
  const resolvedBaseSha = await resolveBaseSha(baseSha, headSha);
  const { stdout } = await execFileAsync(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=ACDMRTUXB',
      resolvedBaseSha,
      headSha,
    ],
    { cwd: rootDir }
  );

  return stdout
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
}

export function assertReleaseInputs(changedPaths) {
  const schemaFileChanged = changedPaths.includes(SCHEMA_PATH);
  const dbMigrationsChanged = changedPaths.some((value) =>
    value.startsWith(MIGRATIONS_PREFIX)
  );

  if (schemaFileChanged && !dbMigrationsChanged) {
    throw new Error(
      `${SCHEMA_PATH} changed without any committed migration in ${MIGRATIONS_PREFIX}`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const changedPaths = await readChangedPaths(options);
  assertReleaseInputs(changedPaths);
  process.stdout.write(
    `[release:check] changed_paths=${changedPaths.length} schema_migration_guard=pass\n`
  );
}

if (process.argv[1]?.endsWith('check-release-inputs.mjs')) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
