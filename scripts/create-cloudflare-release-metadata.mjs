import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { resolveRequiredSiteKey } from './lib/site-config.mjs';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const SCHEMA_PATH = 'src/config/db/schema.ts';
const MIGRATIONS_PREFIX = 'src/config/db/migrations/';
const STATE_TEMPLATE_PATH = 'cloudflare/wrangler.state.toml';

function resolveStateDeployContext(processEnv = process.env) {
  const siteKey = resolveRequiredSiteKey(processEnv);
  const siteConfigPath = `sites/${siteKey}/site.config.json`;
  const siteDeploySettingsPath = `sites/${siteKey}/deploy.settings.json`;

  return {
    siteKey,
    stateReleasePaths: [
      siteConfigPath,
      siteDeploySettingsPath,
      STATE_TEMPLATE_PATH,
      'cloudflare/workers/state.ts',
      'cloudflare/workers/stateful-limiters.ts',
    ],
  };
}

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

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObject(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortObject(entry)])
  );
}

function normalizeStateMigrations(migrations) {
  return JSON.stringify(sortObject(migrations ?? {}));
}

export function hasStateMigrationChange(baseContract, headContract) {
  return (
    normalizeStateMigrations(baseContract?.stateWorker?.migrations) !==
    normalizeStateMigrations(headContract?.stateWorker?.migrations)
  );
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

export async function readJsonAtRevision(revision, filePath) {
  const content = await readFileAtRevision(revision, filePath);
  if (!content.trim()) {
    return null;
  }

  return JSON.parse(content);
}

export function normalizeRevisionSiteConfig(siteConfig, { siteKey }) {
  if (!siteConfig || typeof siteConfig !== 'object') {
    return null;
  }

  const capabilities =
    siteConfig.capabilities && typeof siteConfig.capabilities === 'object'
      ? siteConfig.capabilities
      : {};
  const brand =
    siteConfig.brand && typeof siteConfig.brand === 'object'
      ? siteConfig.brand
      : {};

  return {
    key:
      typeof siteConfig.key === 'string' && siteConfig.key.trim()
        ? siteConfig.key
        : siteKey,
    brand: {
      appUrl:
        typeof brand.appUrl === 'string' && brand.appUrl.trim()
          ? brand.appUrl
          : null,
    },
    capabilities: {
      ai: typeof capabilities.ai === 'boolean' ? capabilities.ai : false,
    },
  };
}

export function normalizeRevisionDeploySettings(deploySettings) {
  if (
    !deploySettings ||
    typeof deploySettings !== 'object' ||
    Array.isArray(deploySettings)
  ) {
    return {};
  }

  const workers =
    deploySettings.workers && typeof deploySettings.workers === 'object'
      ? deploySettings.workers
      : null;
  const state =
    deploySettings.state && typeof deploySettings.state === 'object'
      ? deploySettings.state
      : null;

  const normalized = {};

  if (typeof workers?.state === 'string' && workers.state.trim()) {
    normalized.stateWorkerName = workers.state;
  }

  if (Number.isInteger(state?.schemaVersion) && state.schemaVersion > 0) {
    normalized.stateSchemaVersion = state.schemaVersion;
  }

  return normalized;
}

export function parseStateTemplateMigrations(templateContent) {
  if (!templateContent?.trim()) {
    return null;
  }

  const tagMatch = templateContent.match(/^\s*tag\s*=\s*"([^"]+)"\s*$/m);
  const classesMatch = templateContent.match(
    /^\s*new_sqlite_classes\s*=\s*\[([\s\S]*?)\]\s*$/m
  );

  const migrations = {};

  if (tagMatch?.[1]) {
    migrations.tag = tagMatch[1];
  }

  if (classesMatch?.[1]) {
    const classes = [...classesMatch[1].matchAll(/"([^"]+)"/g)].map(
      ([, value]) => value
    );
    if (classes.length > 0) {
      migrations.newSqliteClasses = classes;
    }
  }

  return Object.keys(migrations).length > 0 ? migrations : null;
}

export function buildRevisionStateDeployInput({
  siteConfig,
  deploySettings,
  stateTemplate,
  siteKey,
}) {
  const normalizedSite = normalizeRevisionSiteConfig(siteConfig, { siteKey });
  const normalizedDeploySettings =
    normalizeRevisionDeploySettings(deploySettings);
  const normalizedMigrations = parseStateTemplateMigrations(stateTemplate);

  if (!normalizedSite) {
    return null;
  }

  const normalized = {
    siteKey: normalizedSite.key,
    appUrl: normalizedSite.brand.appUrl,
    aiEnabled: normalizedSite.capabilities.ai,
    stateWorkerName: normalizedDeploySettings.stateWorkerName ?? null,
    stateSchemaVersion: normalizedDeploySettings.stateSchemaVersion ?? null,
    stateWorker: {
      migrations: normalizedMigrations ?? {},
    },
  };

  if (
    !normalized.stateWorker.migrations.tag &&
    normalized.stateWorkerName &&
    normalized.stateSchemaVersion
  ) {
    normalized.stateWorker.migrations.tag = `${normalized.stateWorkerName}-v${normalized.stateSchemaVersion}`;
  }

  return normalized;
}

export async function resolveSiteDeployContractAtRevision(revision, siteKey) {
  if (!revision || revision === EMPTY_TREE_SHA) {
    return null;
  }

  const siteConfigPath = `sites/${siteKey}/site.config.json`;
  const deploySettingsPath = `sites/${siteKey}/deploy.settings.json`;
  const [siteConfig, deploySettings, stateTemplate] = await Promise.all([
    readJsonAtRevision(revision, siteConfigPath),
    readJsonAtRevision(revision, deploySettingsPath),
    readFileAtRevision(revision, STATE_TEMPLATE_PATH),
  ]);

  return buildRevisionStateDeployInput({
    siteConfig,
    deploySettings,
    stateTemplate,
    siteKey,
  });
}

export async function detectDurableObjectMigrationChange(baseSha, headSha) {
  const { siteKey } = resolveStateDeployContext();
  const [baseContract, headContract] = await Promise.all([
    resolveSiteDeployContractAtRevision(baseSha, siteKey),
    resolveSiteDeployContractAtRevision(headSha, siteKey),
  ]);

  return hasStateMigrationChange(baseContract, headContract);
}

export function detectStateReleaseChange(changedPaths) {
  const { stateReleasePaths } = resolveStateDeployContext();
  return changedPaths.some((changedPath) =>
    stateReleasePaths.some((statePath) =>
      pathMatchesPrefixOrFile(changedPath, statePath)
    )
  );
}

export function buildReleaseMetadata({
  baseSha,
  headSha,
  changedPaths,
  stateChanged,
  stateMigrationsChanged,
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

  return {
    base_sha: baseSha,
    head_sha: headSha,
    db_schema_changed: dbSchemaChanged,
    state_changed: stateChanged,
    state_migrations_changed: stateMigrationsChanged,
    changed_paths: changedPaths,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseSha = await resolveBaseSha(options.baseSha, options.headSha);
  const changedPaths = await readChangedPaths(baseSha, options.headSha);
  const stateChanged = detectStateReleaseChange(changedPaths);
  const stateMigrationsChanged = await detectDurableObjectMigrationChange(
    baseSha,
    options.headSha
  );
  const metadata = buildReleaseMetadata({
    baseSha,
    headSha: options.headSha,
    changedPaths,
    stateChanged,
    stateMigrationsChanged,
  });

  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(
    options.out,
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8'
  );

  process.stdout.write(
    `[cloudflare-release] head=${metadata.head_sha} base=${metadata.base_sha} db_schema_changed=${metadata.db_schema_changed} state_changed=${metadata.state_changed} state_migrations_changed=${metadata.state_migrations_changed}\n`
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
