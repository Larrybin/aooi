import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const SCHEMA_PATH = 'src/config/db/schema.ts';
const MIGRATIONS_PREFIX = 'src/config/db/migrations/';
const ROUTER_WRANGLER_PATH = 'wrangler.cloudflare.toml';
const DO_MIGRATION_ALLOWLIST = [
  '.github/workflows/',
  'scripts/',
  'tests/',
  'cloudflare/workers/stateful-limiters.ts',
  ROUTER_WRANGLER_PATH,
  'README.md',
  'AGENTS.md',
  'docs/',
  SCHEMA_PATH,
  MIGRATIONS_PREFIX,
];

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

function pathMatchesPrefixOrFile(filePath, allowedPath) {
  return (
    filePath === allowedPath ||
    (allowedPath.endsWith('/') && filePath.startsWith(allowedPath))
  );
}

function isAllowedDoMigrationPath(filePath) {
  return DO_MIGRATION_ALLOWLIST.some((allowedPath) =>
    pathMatchesPrefixOrFile(filePath, allowedPath)
  );
}

function extractDurableObjectMigrationSection(content) {
  if (!content.trim()) {
    return '';
  }

  return Array.from(
    content.matchAll(/\[\[migrations\]\]\s*[\s\S]*?(?=\n\[\[|\n\[|$)/g),
    (match) => match[0].trim()
  ).join('\n\n');
}

export async function readFileAtRevision(revision, filePath) {
  if (!revision || revision === EMPTY_TREE_SHA) {
    return '';
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['show', `${revision}:${filePath}`],
      { cwd: rootDir }
    );
    return stdout;
  } catch {
    return '';
  }
}

export async function detectDurableObjectMigrationChange(baseSha, headSha) {
  const [baseContent, headContent] = await Promise.all([
    readFileAtRevision(baseSha, ROUTER_WRANGLER_PATH),
    readFileAtRevision(headSha, ROUTER_WRANGLER_PATH),
  ]);

  return (
    extractDurableObjectMigrationSection(baseContent) !==
    extractDurableObjectMigrationSection(headContent)
  );
}

export function buildReleaseMetadata({
  baseSha,
  headSha,
  changedPaths,
  doMigrationChanged,
}) {
  const schemaFileChanged = changedPaths.includes(SCHEMA_PATH);
  const dbMigrationsChanged = changedPaths.some((value) =>
    value.startsWith(MIGRATIONS_PREFIX)
  );
  const dbSchemaChanged = schemaFileChanged || dbMigrationsChanged;

  if (schemaFileChanged && !dbMigrationsChanged) {
    throw new Error(
      `${SCHEMA_PATH} changed without any committed migration in ${MIGRATIONS_PREFIX}`
    );
  }

  const hasIllegalDoMigrationCompanionChange =
    doMigrationChanged &&
    changedPaths.some((changedPath) => !isAllowedDoMigrationPath(changedPath));

  if (hasIllegalDoMigrationCompanionChange) {
    throw new Error(
      `Durable Object migration changes must be released separately. Split this main commit into a migration-only release and a normal rollout.`
    );
  }

  return {
    base_sha: baseSha,
    head_sha: headSha,
    db_schema_changed: dbSchemaChanged,
    do_migration_changed: doMigrationChanged,
    release_kind: doMigrationChanged ? 'migration' : 'normal',
    changed_paths: changedPaths,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseSha = await resolveBaseSha(options.baseSha, options.headSha);
  const changedPaths = await readChangedPaths(baseSha, options.headSha);
  const doMigrationChanged = await detectDurableObjectMigrationChange(
    baseSha,
    options.headSha
  );
  const metadata = buildReleaseMetadata({
    baseSha,
    headSha: options.headSha,
    changedPaths,
    doMigrationChanged,
  });

  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(
    options.out,
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8'
  );

  process.stdout.write(
    `[cloudflare-release] head=${metadata.head_sha} base=${metadata.base_sha} db_schema_changed=${metadata.db_schema_changed} do_migration_changed=${metadata.do_migration_changed} release_kind=${metadata.release_kind}\n`
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
