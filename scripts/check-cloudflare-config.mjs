import fs from 'node:fs';
import path from 'node:path';

import cloudflareWorkerSplits from '../src/shared/config/cloudflare-worker-splits.ts';

const {
  CLOUDFLARE_ROUTER_WORKER,
  CLOUDFLARE_ROUTER_WORKER_NAME,
  CLOUDFLARE_STATE_WORKER,
  CLOUDFLARE_STATE_WORKER_NAME,
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  CLOUDFLARE_DURABLE_OBJECT_BINDINGS,
  CLOUDFLARE_SERVER_WORKERS,
  CLOUDFLARE_SERVICE_BINDINGS,
  CLOUDFLARE_VERSION_ID_VARS,
  getServerWorkerMetadata,
} = cloudflareWorkerSplits;

const rootDir = process.cwd();
const routerConfigPath = path.resolve(rootDir, CLOUDFLARE_ROUTER_WORKER.wranglerConfigRelativePath);
const stateConfigPath = path.resolve(rootDir, CLOUDFLARE_STATE_WORKER.wranglerConfigRelativePath);
const DO_OWNER_WORKER_NAME = CLOUDFLARE_STATE_WORKER_NAME;
const SHARED_INCREMENTAL_CACHE_BUCKET = 'roller-rabbit-opennext-cache';
const SHARED_APP_STORAGE_BUCKET = 'roller-rabbit-storage';
const DO_BINDINGS = new Map(
  Object.entries(CLOUDFLARE_DURABLE_OBJECT_BINDINGS).map(([name, className]) => [
    name,
    { className },
  ])
);
const serverConfigPaths = Object.fromEntries(
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
    target,
    path.resolve(rootDir, getServerWorkerMetadata(target).wranglerConfigRelativePath),
  ])
);

function fail(message) {
  console.error(`[cf:check] ${message}`);
  process.exit(1);
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`missing ${path.relative(rootDir, filePath)}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function readQuotedValue(content, label, pattern) {
  const match = content.match(pattern);
  if (!match?.[1]?.trim()) {
    fail(`missing ${label}`);
  }

  return match[1].trim();
}

function readMaybeEmptyQuotedValue(content, label, pattern) {
  const match = content.match(pattern);
  if (!match) {
    fail(`missing ${label}`);
  }

  return match[1] ?? '';
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

function readOptionalSection(content, sectionName) {
  const pattern = new RegExp(
    String.raw`\[${sectionName}\]\s*([\s\S]*?)(?=\n\[\[|\n\[|$)`
  );
  const match = content.match(pattern);
  return match?.[1] ?? null;
}

function readFlags(content) {
  const match = content.match(/^\s*compatibility_flags\s*=\s*\[(.+?)\]/m);
  if (!match?.[1]) {
    fail('missing compatibility_flags');
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), (flag) => flag[1]).sort();
}

function assertSharedSettings(content, label, options = {}) {
  const {
    requiresAssets = true,
    requiresR2Buckets = true,
    requiresHyperdrive = true,
  } = options;
  const compatibilityDate = readQuotedValue(
    content,
    `${label}.compatibility_date`,
    /^\s*compatibility_date\s*=\s*"([^"\n]+)"/m
  );
  const workersDev = readBooleanValue(
    content,
    `${label}.workers_dev`,
    /^\s*workers_dev\s*=\s*(true|false)/m
  );
  const previewUrls = readBooleanValue(
    content,
    `${label}.preview_urls`,
    /^\s*preview_urls\s*=\s*(true|false)/m
  );
  const flags = readFlags(content);

  if (compatibilityDate !== '2025-03-01') {
    fail(`${label}.compatibility_date must equal 2025-03-01`);
  }

  if (workersDev !== 'false') {
    fail(`${label}.workers_dev must be false`);
  }

  if (previewUrls !== 'false') {
    fail(`${label}.preview_urls must be false`);
  }

  const expectedFlags = ['global_fetch_strictly_public', 'nodejs_compat'];
  if (JSON.stringify(flags) !== JSON.stringify(expectedFlags)) {
    fail(
      `${label}.compatibility_flags must equal ${expectedFlags.join(', ')}`
    );
  }

  const observabilitySection = readSection(content, 'observability');
  const observabilityEnabled = readBooleanValue(
    observabilitySection,
    `${label}.observability.enabled`,
    /^\s*enabled\s*=\s*(true|false)/m
  );
  if (observabilityEnabled !== 'true') {
    fail(`${label}.observability.enabled must be true`);
  }

  const assetsSection = readOptionalSection(content, 'assets');
  if (requiresAssets) {
    if (!assetsSection) {
      fail(`missing [assets] section`);
    }

    const assetsBinding = readQuotedValue(
      assetsSection,
      `${label}.assets.binding`,
      /^\s*binding\s*=\s*"([^"\n]+)"/m
    );
    if (assetsBinding !== 'ASSETS') {
      fail(`${label}.assets.binding must equal ASSETS`);
    }
  } else if (assetsSection) {
    fail(`${label} must not define [assets]`);
  }

  const r2BucketTables = readArrayTable(content, 'r2_buckets');
  if (requiresR2Buckets) {
    const incrementalCacheBucket = r2BucketTables.find((table) =>
      /^\s*binding\s*=\s*"NEXT_INC_CACHE_R2_BUCKET"/m.test(table)
    );
    if (!incrementalCacheBucket) {
      fail(`${label} missing [[r2_buckets]] binding = "NEXT_INC_CACHE_R2_BUCKET"`);
    }
    const incrementalBucketName = readQuotedValue(
      incrementalCacheBucket,
      `${label}.r2_buckets.NEXT_INC_CACHE_R2_BUCKET.bucket_name`,
      /^\s*bucket_name\s*=\s*"([^"\n]+)"/m
    );
    if (incrementalBucketName !== SHARED_INCREMENTAL_CACHE_BUCKET) {
      fail(
        `${label}.NEXT_INC_CACHE_R2_BUCKET bucket_name must equal ${SHARED_INCREMENTAL_CACHE_BUCKET}`
      );
    }

    const appStorageBucket = r2BucketTables.find((table) =>
      /^\s*binding\s*=\s*"APP_STORAGE_R2_BUCKET"/m.test(table)
    );
    if (!appStorageBucket) {
      fail(`${label} missing [[r2_buckets]] binding = "APP_STORAGE_R2_BUCKET"`);
    }
    const appStorageBucketName = readQuotedValue(
      appStorageBucket,
      `${label}.r2_buckets.APP_STORAGE_R2_BUCKET.bucket_name`,
      /^\s*bucket_name\s*=\s*"([^"\n]+)"/m
    );
    if (appStorageBucketName !== SHARED_APP_STORAGE_BUCKET) {
      fail(
        `${label}.APP_STORAGE_R2_BUCKET bucket_name must equal ${SHARED_APP_STORAGE_BUCKET}`
      );
    }
  } else if (r2BucketTables.length > 0) {
    fail(`${label} must not define [[r2_buckets]]`);
  }

  const hyperdriveTables = readArrayTable(content, 'hyperdrive');
  if (requiresHyperdrive) {
    const hyperdrive = hyperdriveTables.find((table) =>
      /^\s*binding\s*=\s*"HYPERDRIVE"/m.test(table)
    );
    if (!hyperdrive) {
      fail(`${label} missing [[hyperdrive]] binding = "HYPERDRIVE"`);
    }

    const localConnectionString = readMaybeEmptyQuotedValue(
      hyperdrive,
      `${label}.hyperdrive.localConnectionString`,
      /^\s*localConnectionString\s*=\s*"([^"\n]*)"/m
    );
    if (localConnectionString !== '') {
      fail(`${label}.hyperdrive.localConnectionString must be empty in tracked templates`);
    }
  } else if (hyperdriveTables.length > 0) {
    fail(`${label} must not define [[hyperdrive]]`);
  }

  const varsSection = readSection(content, 'vars');
  const deployTarget = readQuotedValue(
    varsSection,
    `${label}.vars.DEPLOY_TARGET`,
    /^\s*DEPLOY_TARGET\s*=\s*"([^"\n]+)"/m
  );
  const appUrl = readQuotedValue(
    varsSection,
    `${label}.vars.NEXT_PUBLIC_APP_URL`,
    /^\s*NEXT_PUBLIC_APP_URL\s*=\s*"([^"\n]+)"/m
  );

  if (deployTarget !== 'cloudflare') {
    fail(`${label}.vars.DEPLOY_TARGET must equal cloudflare`);
  }

  if (appUrl !== 'https://mamamiya.pdfreprinting.net/') {
    fail(
      `${label}.vars.NEXT_PUBLIC_APP_URL must equal https://mamamiya.pdfreprinting.net/`
    );
  }
}

function assertRouterConfig() {
  const content = readFile(routerConfigPath);
  assertSharedSettings(content, 'router');

  const workerName = readQuotedValue(
    content,
    'router.name',
    /^\s*name\s*=\s*"([^"\n]+)"/m
  );
  const main = readQuotedValue(
    content,
    'router.main',
    /^\s*main\s*=\s*"([^"\n]+)"/m
  );

  if (workerName !== CLOUDFLARE_ROUTER_WORKER_NAME) {
    fail(`router.name must equal ${CLOUDFLARE_ROUTER_WORKER_NAME}`);
  }

  if (main !== 'cloudflare/workers/router.ts') {
    fail('router.main must equal cloudflare/workers/router.ts');
  }

  const imagesSection = readSection(content, 'images');
  const imagesBinding = readQuotedValue(
    imagesSection,
    'router.images.binding',
    /^\s*binding\s*=\s*"([^"\n]+)"/m
  );
  if (imagesBinding !== 'IMAGES') {
    fail('router.images.binding must equal IMAGES');
  }

  const serviceTables = readArrayTable(content, 'services');
  const expectedServices = new Map([
    ['WORKER_SELF_REFERENCE', CLOUDFLARE_ROUTER_WORKER_NAME],
    ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
      CLOUDFLARE_SERVICE_BINDINGS[target],
      CLOUDFLARE_SERVER_WORKERS[target],
    ]),
  ]);

  for (const [binding, expectedService] of expectedServices) {
    const table = serviceTables.find((entry) =>
      new RegExp(`^\\s*binding\\s*=\\s*"${binding}"`, 'm').test(entry)
    );
    if (!table) {
      fail(`router missing [[services]] binding = "${binding}"`);
    }

    const service = readQuotedValue(
      table,
      `router.services.${binding}.service`,
      /^\s*service\s*=\s*"([^"\n]+)"/m
    );
    if (service !== expectedService) {
      fail(`router.services.${binding}.service must equal ${expectedService}`);
    }
  }

  const varsSection = readSection(content, 'vars');
  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    readMaybeEmptyQuotedValue(
      varsSection,
      `router.vars.${CLOUDFLARE_VERSION_ID_VARS[target]}`,
      new RegExp(
        String.raw`^\s*${CLOUDFLARE_VERSION_ID_VARS[target]}\s*=\s*"([^"\n]*)"`,
        'm'
      )
    );
  }

  const doTables = readArrayTable(content, 'durable_objects.bindings');
  for (const [bindingName, { className }] of DO_BINDINGS) {
    const table = doTables.find((entry) =>
      new RegExp(`^\\s*name\\s*=\\s*"${bindingName}"`, 'm').test(entry)
    );
    if (!table) {
      fail(`router missing [[durable_objects.bindings]] name = "${bindingName}"`);
    }

    const actualClassName = readQuotedValue(
      table,
      `router.durable_objects.${bindingName}.class_name`,
      /^\s*class_name\s*=\s*"([^"\n]+)"/m
    );
    if (actualClassName !== className) {
      fail(
        `router.durable_objects.${bindingName}.class_name must equal ${className}`
      );
    }

    const scriptName = readQuotedValue(
      table,
      `router.durable_objects.${bindingName}.script_name`,
      /^\s*script_name\s*=\s*"([^"\n]+)"/m
    );
    if (scriptName !== DO_OWNER_WORKER_NAME) {
      fail(
        `router.durable_objects.${bindingName}.script_name must equal ${DO_OWNER_WORKER_NAME}`
      );
    }
  }

  const migrationTables = readArrayTable(content, 'migrations');
  if (migrationTables.length > 0) {
    fail('router must not define [[migrations]]');
  }
}

function assertStateConfig() {
  const content = readFile(stateConfigPath);
  assertSharedSettings(content, 'state', {
    requiresAssets: false,
    requiresR2Buckets: false,
    requiresHyperdrive: false,
  });

  const workerName = readQuotedValue(
    content,
    'state.name',
    /^\s*name\s*=\s*"([^"\n]+)"/m
  );
  const main = readQuotedValue(
    content,
    'state.main',
    /^\s*main\s*=\s*"([^"\n]+)"/m
  );

  if (workerName !== CLOUDFLARE_STATE_WORKER_NAME) {
    fail(`state.name must equal ${CLOUDFLARE_STATE_WORKER_NAME}`);
  }

  if (main !== 'workers/state.ts') {
    fail('state.main must equal workers/state.ts');
  }

  const serviceTables = readArrayTable(content, 'services');
  const selfReference = serviceTables.find((table) =>
    /^\s*binding\s*=\s*"WORKER_SELF_REFERENCE"/m.test(table)
  );
  if (!selfReference) {
    fail('state missing [[services]] binding = "WORKER_SELF_REFERENCE"');
  }

  const service = readQuotedValue(
    selfReference,
    'state.services.WORKER_SELF_REFERENCE.service',
    /^\s*service\s*=\s*"([^"\n]+)"/m
  );
  if (service !== CLOUDFLARE_ROUTER_WORKER_NAME) {
    fail(
      `state.services.WORKER_SELF_REFERENCE.service must equal ${CLOUDFLARE_ROUTER_WORKER_NAME}`
    );
  }

  const doTables = readArrayTable(content, 'durable_objects.bindings');
  for (const [bindingName, { className }] of DO_BINDINGS) {
    const table = doTables.find((entry) =>
      new RegExp(`^\\s*name\\s*=\\s*"${bindingName}"`, 'm').test(entry)
    );
    if (!table) {
      fail(`state missing [[durable_objects.bindings]] name = "${bindingName}"`);
    }

    const actualClassName = readQuotedValue(
      table,
      `state.durable_objects.${bindingName}.class_name`,
      /^\s*class_name\s*=\s*"([^"\n]+)"/m
    );
    if (actualClassName !== className) {
      fail(
        `state.durable_objects.${bindingName}.class_name must equal ${className}`
      );
    }
  }

  const migrationTables = readArrayTable(content, 'migrations');
  if (migrationTables.length === 0) {
    fail('state missing [[migrations]] as the Durable Object owner');
  }
}

function assertServerConfig(target, configPath) {
  const content = readFile(configPath);
  assertSharedSettings(content, `${target}`);

  const workerName = readQuotedValue(
    content,
    `${target}.name`,
    /^\s*name\s*=\s*"([^"\n]+)"/m
  );
  const main = readQuotedValue(
    content,
    `${target}.main`,
    /^\s*main\s*=\s*"([^"\n]+)"/m
  );
  const expectedMain = getServerWorkerMetadata(target).workerEntryRelativePath.replace(
    /^cloudflare\//,
    ''
  );

  if (workerName !== CLOUDFLARE_SERVER_WORKERS[target]) {
    fail(`${target}.name must equal ${CLOUDFLARE_SERVER_WORKERS[target]}`);
  }

  if (main !== expectedMain) {
    fail(`${target}.main must equal ${expectedMain}`);
  }

  if (/^\s*\[\[routes\]\]/m.test(content)) {
    fail(`${target} must not define [[routes]]`);
  }

  const serviceTables = readArrayTable(content, 'services');
  const selfReference = serviceTables.find((table) =>
    /^\s*binding\s*=\s*"WORKER_SELF_REFERENCE"/m.test(table)
  );
  if (!selfReference) {
    fail(`${target} missing [[services]] binding = "WORKER_SELF_REFERENCE"`);
  }

  const service = readQuotedValue(
    selfReference,
    `${target}.services.WORKER_SELF_REFERENCE.service`,
    /^\s*service\s*=\s*"([^"\n]+)"/m
  );
  if (service !== CLOUDFLARE_ROUTER_WORKER_NAME) {
    fail(
      `${target}.services.WORKER_SELF_REFERENCE.service must equal ${CLOUDFLARE_ROUTER_WORKER_NAME}`
    );
  }

  const imagesSection = readOptionalSection(content, 'images');
  if (imagesSection) {
    fail(`${target} must not define [images]`);
  }

  const doTables = readArrayTable(content, 'durable_objects.bindings');
  for (const [bindingName, { className }] of DO_BINDINGS) {
    const table = doTables.find((entry) =>
      new RegExp(`^\\s*name\\s*=\\s*"${bindingName}"`, 'm').test(entry)
    );
    if (!table) {
      fail(`${target} missing [[durable_objects.bindings]] name = "${bindingName}"`);
    }

    const actualClassName = readQuotedValue(
      table,
      `${target}.durable_objects.${bindingName}.class_name`,
      /^\s*class_name\s*=\s*"([^"\n]+)"/m
    );
    if (actualClassName !== className) {
      fail(
        `${target}.durable_objects.${bindingName}.class_name must equal ${className}`
      );
    }

    const scriptName = readQuotedValue(
      table,
      `${target}.durable_objects.${bindingName}.script_name`,
      /^\s*script_name\s*=\s*"([^"\n]+)"/m
    );
    if (scriptName !== DO_OWNER_WORKER_NAME) {
      fail(
        `${target}.durable_objects.${bindingName}.script_name must equal ${DO_OWNER_WORKER_NAME}`
      );
    }
  }

  const migrationTables = readArrayTable(content, 'migrations');
  if (migrationTables.length > 0) {
    fail(`${target} must not define [[migrations]] because only state owns Durable Objects`);
  }
}

assertRouterConfig();
assertStateConfig();
for (const [target, configPath] of Object.entries(serverConfigPaths)) {
  assertServerConfig(target, configPath);
}

console.log('[cf:check] production-only state/app Cloudflare config structure looks good');
