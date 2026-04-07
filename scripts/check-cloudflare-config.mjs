import fs from 'node:fs';
import path from 'node:path';

const isDeployCheck = process.argv.includes('--deploy');
const configPath = path.resolve(process.cwd(), 'wrangler.toml');

function fail(message) {
  console.error(`[cf:check] ${message}`);
  process.exit(1);
}

function readConfigFile() {
  if (!fs.existsSync(configPath)) {
    fail('missing wrangler.toml');
  }

  return fs.readFileSync(configPath, 'utf8');
}

function readQuotedValue(content, label, pattern) {
  const match = content.match(pattern);
  if (!match?.[1]?.trim()) {
    fail(`missing ${label}`);
  }

  return match[1].trim();
}

function readBooleanValue(content, label, pattern) {
  const match = content.match(pattern);
  if (!match?.[1]?.trim()) {
    fail(`missing ${label}`);
  }

  return match[1].trim();
}

function readArrayTable(content, tableName) {
  const pattern = new RegExp(
    String.raw`\[\[${tableName}\]\]\s*([\s\S]*?)(?=\n\[\[|\n\[|$)`,
    'g'
  );

  return Array.from(content.matchAll(pattern), (match) => match[1]);
}

function readSection(content, sectionName) {
  const pattern = new RegExp(
    String.raw`\[${sectionName}\]\s*([\s\S]*?)(?=\n\[\[|\n\[|$)`
  );
  const match = content.match(pattern);
  if (!match?.[1]) {
    fail(`missing [${sectionName}] section`);
  }

  return match[1];
}

function includesFlag(content, flag) {
  const flagsMatch = content.match(/^\s*compatibility_flags\s*=\s*\[(.+?)\]/m);
  if (!flagsMatch?.[1]) {
    fail('missing compatibility_flags');
  }

  return flagsMatch[1].includes(`"${flag}"`);
}

function isPlaceholderWorkerName(name) {
  return ['', 'my-app', 'my-next-app'].includes(name);
}

function isLocalhostUrl(value) {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return true;
  }
}

function parseHttpOrigin(value, label, { requirePureOrigin = false } = {}) {
  let url;

  try {
    url = new URL(value);
  } catch {
    fail(`${label} must be a valid http/https origin`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    fail(`${label} must use http/https`);
  }

  if (requirePureOrigin) {
    if (url.pathname !== '/' || url.search || url.hash) {
      fail(`${label} must be a pure origin without path/query/hash`);
    }
  }

  return url.origin;
}

const content = readConfigFile();

const workerName = readQuotedValue(
  content,
  'name',
  /^\s*name\s*=\s*"([^"\n]+)"/m
);
const compatibilityDate = readQuotedValue(
  content,
  'compatibility_date',
  /^\s*compatibility_date\s*=\s*"([^"\n]+)"/m
);
const main = readQuotedValue(content, 'main', /^\s*main\s*=\s*"([^"\n]+)"/m);
const workersDev = readBooleanValue(
  content,
  'workers_dev',
  /^\s*workers_dev\s*=\s*(true|false)/m
);
const previewUrls = readBooleanValue(
  content,
  'preview_urls',
  /^\s*preview_urls\s*=\s*(true|false)/m
);

if (workerName !== 'roller-rabbit') {
  fail(`unexpected worker name: ${workerName}`);
}

if (main !== 'cloudflare/public-shell-worker.mjs') {
  fail(`unexpected main: ${main}`);
}

if (compatibilityDate !== '2025-03-01') {
  fail(`unexpected compatibility_date: ${compatibilityDate}`);
}

if (workersDev !== 'false') {
  fail('workers_dev must be false');
}

if (previewUrls !== 'false') {
  fail('preview_urls must be false');
}

if (!includesFlag(content, 'nodejs_compat')) {
  fail('compatibility_flags must include "nodejs_compat"');
}

if (!includesFlag(content, 'global_fetch_strictly_public')) {
  fail('compatibility_flags must include "global_fetch_strictly_public"');
}

const assetsSection = readSection(content, 'assets');
const assetsBinding = readQuotedValue(
  assetsSection,
  'assets.binding',
  /^\s*binding\s*=\s*"([^"\n]+)"/m
);
const assetsDirectory = readQuotedValue(
  assetsSection,
  'assets.directory',
  /^\s*directory\s*=\s*"([^"\n]+)"/m
);

if (assetsBinding !== 'ASSETS') {
  fail(`unexpected assets binding: ${assetsBinding}`);
}

if (assetsDirectory !== '.open-next/assets') {
  fail(`unexpected assets directory: ${assetsDirectory}`);
}

const serviceTables = readArrayTable(content, 'services');
const selfReference = serviceTables.find((table) =>
  /^\s*binding\s*=\s*"WORKER_SELF_REFERENCE"/m.test(table)
);

if (!selfReference) {
  fail('missing [[services]] binding = "WORKER_SELF_REFERENCE"');
}

const selfReferenceService = readQuotedValue(
  selfReference,
  'services.WORKER_SELF_REFERENCE.service',
  /^\s*service\s*=\s*"([^"\n]+)"/m
);

if (selfReferenceService !== workerName) {
  fail(
    `WORKER_SELF_REFERENCE.service must equal worker name (${workerName}), got ${selfReferenceService}`
  );
}

const hyperdriveTables = readArrayTable(content, 'hyperdrive');
const hyperdrive = hyperdriveTables.find((table) =>
  /^\s*binding\s*=\s*"HYPERDRIVE"/m.test(table)
);

if (!hyperdrive) {
  fail('missing [[hyperdrive]] binding = "HYPERDRIVE"');
}

const localConnectionString = readQuotedValue(
  hyperdrive,
  'hyperdrive.localConnectionString',
  /^\s*localConnectionString\s*=\s*"([^"\n]+)"/m
);

if (!localConnectionString) {
  fail('hyperdrive.localConnectionString must be set');
}

const observabilitySection = readSection(content, 'observability');
const observabilityEnabled = readBooleanValue(
  observabilitySection,
  'observability.enabled',
  /^\s*enabled\s*=\s*(true|false)/m
);

if (observabilityEnabled !== 'true') {
  fail('observability.enabled must be true');
}

const varsSection = readSection(content, 'vars');
const appUrl = readQuotedValue(
  varsSection,
  'vars.NEXT_PUBLIC_APP_URL',
  /^\s*NEXT_PUBLIC_APP_URL\s*=\s*"([^"\n]+)"/m
);
readQuotedValue(
  varsSection,
  'vars.CF_FALLBACK_ORIGIN',
  /^\s*CF_FALLBACK_ORIGIN\s*=\s*"([^"\n]+)"/m
);
readQuotedValue(
  varsSection,
  'vars.NEXT_PUBLIC_APP_NAME',
  /^\s*NEXT_PUBLIC_APP_NAME\s*=\s*"([^"\n]+)"/m
);
readQuotedValue(
  varsSection,
  'vars.NEXT_PUBLIC_THEME',
  /^\s*NEXT_PUBLIC_THEME\s*=\s*"([^"\n]+)"/m
);
readQuotedValue(
  varsSection,
  'vars.DATABASE_PROVIDER',
  /^\s*DATABASE_PROVIDER\s*=\s*"([^"\n]+)"/m
);
readQuotedValue(
  varsSection,
  'vars.DB_SINGLETON_ENABLED',
  /^\s*DB_SINGLETON_ENABLED\s*=\s*"([^"\n]+)"/m
);

const appOrigin = parseHttpOrigin(appUrl, 'vars.NEXT_PUBLIC_APP_URL');
const appHostname = new URL(appOrigin).hostname;
const routeTables = readArrayTable(content, 'routes');
const customDomainRoute = routeTables.find((table) => {
  const pattern = table.match(/^\s*pattern\s*=\s*"([^"\n]+)"/m)?.[1]?.trim();
  const customDomain = table.match(/^\s*custom_domain\s*=\s*(true|false)/m)?.[1];
  return pattern === appHostname && customDomain === 'true';
});

if (!customDomainRoute) {
  fail(
    `missing [[routes]] custom domain route for ${appHostname}`
  );
}

if (!isDeployCheck) {
  console.log('[cf:check] wrangler.toml structure looks good');
  process.exit(0);
}

if (isPlaceholderWorkerName(workerName)) {
  fail(`worker name must not be a template value, got ${workerName}`);
}

const hyperdriveId = readQuotedValue(
  hyperdrive,
  'hyperdrive.id',
  /^\s*id\s*=\s*"([^"\n]*)"/m
);

if (!hyperdriveId) {
  fail('hyperdrive.id must be set for deploy/upload');
}

const fallbackOrigin = readQuotedValue(
  varsSection,
  'vars.CF_FALLBACK_ORIGIN',
  /^\s*CF_FALLBACK_ORIGIN\s*=\s*"([^"\n]+)"/m
);

if (isLocalhostUrl(appUrl)) {
  fail(
    'vars.NEXT_PUBLIC_APP_URL must not point to localhost for deploy/upload'
  );
}

const fallbackUrlOrigin = parseHttpOrigin(
  fallbackOrigin,
  'vars.CF_FALLBACK_ORIGIN',
  { requirePureOrigin: true }
);

if (isLocalhostUrl(fallbackOrigin)) {
  fail(
    'vars.CF_FALLBACK_ORIGIN must not point to localhost for deploy/upload'
  );
}

if (fallbackUrlOrigin === appOrigin) {
  fail(
    'vars.CF_FALLBACK_ORIGIN must not equal vars.NEXT_PUBLIC_APP_URL for deploy/upload'
  );
}

console.log('[cf:check] deploy configuration looks good');
