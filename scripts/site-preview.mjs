import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import siteEnvModule from '../src/config/site-env.cjs';
import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './lib/site-config.mjs';
import {
  buildPreviewBucketName,
  buildPreviewRouterOrigin,
  buildPreviewWorkerName,
} from './lib/site-deploy-profile.mjs';
import {
  DEPLOY_SETTINGS_CONFIG_VERSION,
  readSiteDeploySettings,
  resolveSitePreviewDeploySettingsPath,
  validateSitePreviewDeploySettings,
} from './lib/site-deploy-settings.mjs';

const { applySiteLocalEnvOverlay, readSiteLocalEnv, resolveSiteLocalEnvPath } =
  siteEnvModule;

const HYPERDRIVE_ID_PATTERN = /^[a-f0-9]{32}$/u;
const ANSI_PATTERN = /\u001b\[[0-9;]*m/gu;
const PREVIEW_MODE_CHOICES = ['doctor', 'provision', 'deploy'];

function trimEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasOwnEnvValue(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function relativePath(rootDir, targetPath) {
  return path.relative(rootDir, targetPath) || '.';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function stripAnsi(value) {
  return value.replace(ANSI_PATTERN, '');
}

function redactValues(value, secrets) {
  let result = value;
  for (const secret of secrets) {
    if (secret) {
      result = result.split(secret).join('<redacted>');
    }
  }
  return result;
}

export function isValidHyperdriveId(value) {
  return HYPERDRIVE_ID_PATTERN.test(value);
}

export function buildPreviewResourceNames(siteKey, processEnv = process.env) {
  return {
    cacheBucket: buildPreviewBucketName(siteKey, 'opennext-cache'),
    routerOrigin: buildPreviewRouterOrigin(siteKey, processEnv),
    routerWorker: buildPreviewWorkerName(siteKey, 'router'),
    storageBucket: buildPreviewBucketName(siteKey, 'storage'),
  };
}

export function buildPreviewDeploySettingsJson(hyperdriveId) {
  if (!isValidHyperdriveId(hyperdriveId)) {
    throw new Error(
      'preview Hyperdrive id must be a 32-character lowercase hex value'
    );
  }

  return `${JSON.stringify(
    {
      configVersion: DEPLOY_SETTINGS_CONFIG_VERSION,
      resources: {
        hyperdriveId,
      },
    },
    null,
    2
  )}\n`;
}

export function r2BucketListHasName(output, bucketName) {
  const cleanOutput = stripAnsi(output);
  const pattern = new RegExp(
    `(^|[^a-z0-9.-])${escapeRegExp(bucketName)}([^a-z0-9.-]|$)`,
    'u'
  );
  return pattern.test(cleanOutput);
}

export function parseHyperdriveIdFromOutput(output) {
  const cleanOutput = stripAnsi(output);
  const preferredMatch = cleanOutput.match(
    /\b(?:id|ID)\s*[:=]\s*([a-f0-9]{32})\b/u
  );
  if (preferredMatch) {
    return preferredMatch[1];
  }

  return cleanOutput.match(/\b[a-f0-9]{32}\b/u)?.[0] ?? '';
}

function readPreviewDeploySettingsStatus({ rootDir, siteKey }) {
  const filePath = resolveSitePreviewDeploySettingsPath({ rootDir, siteKey });
  if (!existsSync(filePath)) {
    return {
      filePath,
      hyperdriveId: '',
      state: 'missing',
    };
  }

  try {
    const config = JSON.parse(readFileSync(filePath, 'utf8'));
    validateSitePreviewDeploySettings(config);
    return {
      filePath,
      hyperdriveId: config.resources.hyperdriveId,
      state: 'valid',
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      filePath,
      hyperdriveId: '',
      state: 'invalid',
    };
  }
}

function createPreviewCommandEnv({
  rootDir,
  siteKey,
  processEnv = process.env,
}) {
  const env = {
    ...processEnv,
    CF_DEPLOY_PROFILE: 'preview',
    SITE: siteKey,
  };

  applySiteLocalEnvOverlay({
    env,
    originalEnv: processEnv,
    rootDir,
    siteKey,
  });

  env.PATH = [
    processEnv.PATH,
    env.PATH,
    path.dirname(process.execPath),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ]
    .filter(Boolean)
    .join(':');

  return env;
}

function resolveOperatorValue({ envFileValues, name, processEnv }) {
  if (hasOwnEnvValue(processEnv, name)) {
    return trimEnvValue(processEnv[name]);
  }

  return trimEnvValue(envFileValues[name]);
}

function createPreviewContext({
  processEnv = process.env,
  rootDir = process.cwd(),
} = {}) {
  const siteKey = resolveRequiredSiteKey(processEnv);
  readCurrentSiteConfig({ rootDir, siteKey });
  readSiteDeploySettings({ rootDir, siteKey });

  const envFilePath = resolveSiteLocalEnvPath({ rootDir, siteKey });
  const envFileValues = readSiteLocalEnv({ rootDir, siteKey });
  const workersDevSubdomain = resolveOperatorValue({
    envFileValues,
    name: 'CF_WORKERS_DEV_SUBDOMAIN',
    processEnv,
  });
  const previewDatabaseUrl = resolveOperatorValue({
    envFileValues,
    name: 'PREVIEW_DATABASE_URL',
    processEnv,
  });
  const resourceEnv = {
    ...processEnv,
    CF_WORKERS_DEV_SUBDOMAIN: workersDevSubdomain,
  };
  const resourceNames = workersDevSubdomain
    ? buildPreviewResourceNames(siteKey, resourceEnv)
    : {
        cacheBucket: buildPreviewBucketName(siteKey, 'opennext-cache'),
        routerOrigin: '',
        routerWorker: buildPreviewWorkerName(siteKey, 'router'),
        storageBucket: buildPreviewBucketName(siteKey, 'storage'),
      };

  return {
    envFilePath,
    envFileValues,
    previewDatabaseUrl,
    previewSettings: readPreviewDeploySettingsStatus({ rootDir, siteKey }),
    resourceNames,
    rootDir,
    siteKey,
    workersDevSubdomain,
  };
}

function formatStatusLine(status, label, detail = '') {
  return `[${status}] ${label}${detail ? `: ${detail}` : ''}`;
}

function printStatus(status, label, detail = '') {
  console.log(formatStatusLine(status, label, detail));
}

function runCommandCapture(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({
        code: 1,
        output: error.message,
        stderr: error.message,
        stdout,
      });
    });
    child.on('close', (code) => {
      resolve({
        code: typeof code === 'number' ? code : 1,
        output: `${stdout}${stderr}`,
        stderr,
        stdout,
      });
    });
  });
}

function runCommandInherit(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });

    child.on('error', () => {
      resolve(1);
    });
    child.on('close', (code) => {
      resolve(typeof code === 'number' ? code : 1);
    });
  });
}

function resolvePnpmInvocation(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return {
      args: [npmExecPath, ...args],
      command: process.execPath,
    };
  }

  return {
    args,
    command: 'pnpm',
  };
}

function runPnpmCapture(args, env) {
  const invocation = resolvePnpmInvocation(args);
  return runCommandCapture(invocation.command, invocation.args, env);
}

function runPnpmInherit(args, env) {
  const invocation = resolvePnpmInvocation(args);
  return runCommandInherit(invocation.command, invocation.args, env);
}

async function runWrangler(args, env) {
  return runPnpmCapture(['exec', 'wrangler', ...args], env);
}

function assertWranglerSuccess(label, result, secrets = []) {
  if (result.code === 0) {
    return;
  }

  const output = redactValues(stripAnsi(result.output).trim(), secrets);
  throw new Error(`${label} failed${output ? `:\n${output}` : ''}`);
}

async function checkR2Bucket(bucketName, env) {
  const result = await runWrangler(['r2', 'bucket', 'list'], env);
  assertWranglerSuccess('list R2 buckets', result);
  return r2BucketListHasName(result.output, bucketName);
}

async function ensureR2Bucket(bucketName, env) {
  if (await checkR2Bucket(bucketName, env)) {
    printStatus('ok', 'R2 bucket', bucketName);
    return;
  }

  printStatus('create', 'R2 bucket', bucketName);
  const result = await runWrangler(['r2', 'bucket', 'create', bucketName], env);
  if (
    result.code !== 0 &&
    !/already exists|already owned|bucket exists/iu.test(result.output)
  ) {
    assertWranglerSuccess(`create R2 bucket ${bucketName}`, result);
  }
  printStatus('ok', 'R2 bucket', bucketName);
}

async function checkHyperdrive(hyperdriveId, env) {
  if (!isValidHyperdriveId(hyperdriveId)) {
    return false;
  }

  const result = await runWrangler(['hyperdrive', 'get', hyperdriveId], env);
  return result.code === 0;
}

async function checkWorker(workerName, env) {
  const result = await runWrangler(
    ['deployments', 'list', '--name', workerName, '--json'],
    env
  );
  return result.code === 0;
}

function requirePreviewOperatorValues(context) {
  const missing = [];
  if (!context.workersDevSubdomain) {
    missing.push('CF_WORKERS_DEV_SUBDOMAIN');
  }
  if (!context.previewDatabaseUrl) {
    missing.push('PREVIEW_DATABASE_URL');
  }

  if (missing.length > 0) {
    throw new Error(
      `missing required preview value(s) in sites/${context.siteKey}/.env.local or shell: ${missing.join(
        ', '
      )}`
    );
  }
}

async function runDoctor() {
  const context = createPreviewContext();
  const env = createPreviewCommandEnv(context);
  let failures = 0;

  printStatus('ok', 'site', context.siteKey);
  printStatus(
    'ok',
    'deploy settings',
    `sites/${context.siteKey}/deploy.settings.json`
  );

  if (existsSync(context.envFilePath)) {
    printStatus(
      'ok',
      'operator env',
      relativePath(context.rootDir, context.envFilePath)
    );
  } else {
    failures += 1;
    printStatus(
      'missing',
      'operator env',
      `create sites/${context.siteKey}/.env.local`
    );
  }

  if (context.workersDevSubdomain) {
    printStatus('ok', 'CF_WORKERS_DEV_SUBDOMAIN');
  } else {
    failures += 1;
    printStatus('missing', 'CF_WORKERS_DEV_SUBDOMAIN');
  }

  if (context.previewDatabaseUrl) {
    printStatus('ok', 'PREVIEW_DATABASE_URL');
  } else {
    failures += 1;
    printStatus('missing', 'PREVIEW_DATABASE_URL');
  }

  if (context.previewSettings.state === 'valid') {
    printStatus(
      'ok',
      'preview deploy settings',
      relativePath(context.rootDir, context.previewSettings.filePath)
    );
  } else {
    failures += 1;
    printStatus(
      context.previewSettings.state,
      'preview deploy settings',
      context.previewSettings.error ||
        `create ${relativePath(context.rootDir, context.previewSettings.filePath)}`
    );
  }

  if (context.resourceNames.routerOrigin) {
    printStatus('ok', 'preview URL', context.resourceNames.routerOrigin);
  }

  if (context.workersDevSubdomain) {
    for (const bucketName of [
      context.resourceNames.cacheBucket,
      context.resourceNames.storageBucket,
    ]) {
      try {
        if (await checkR2Bucket(bucketName, env)) {
          printStatus('ok', 'R2 bucket', bucketName);
        } else {
          failures += 1;
          printStatus('missing', 'R2 bucket', bucketName);
        }
      } catch (error) {
        failures += 1;
        printStatus(
          'error',
          'R2 bucket check',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  if (context.previewSettings.state === 'valid') {
    if (await checkHyperdrive(context.previewSettings.hyperdriveId, env)) {
      printStatus(
        'ok',
        'Hyperdrive config',
        context.previewSettings.hyperdriveId
      );
    } else {
      failures += 1;
      printStatus(
        'missing',
        'Hyperdrive config',
        context.previewSettings.hyperdriveId
      );
    }
  }

  try {
    if (await checkWorker(context.resourceNames.routerWorker, env)) {
      printStatus(
        'ok',
        'preview router worker',
        context.resourceNames.routerWorker
      );
    } else {
      failures += 1;
      printStatus(
        'missing',
        'preview router worker',
        context.resourceNames.routerWorker
      );
    }
  } catch (error) {
    failures += 1;
    printStatus(
      'error',
      'preview router worker check',
      error instanceof Error ? error.message : String(error)
    );
  }

  if (failures > 0) {
    printStatus('fail', 'preview readiness', `${failures} issue(s)`);
    return 1;
  }

  printStatus('ok', 'preview readiness');
  return 0;
}

async function runProvision() {
  const context = createPreviewContext();
  requirePreviewOperatorValues(context);
  const env = createPreviewCommandEnv(context);

  await ensureR2Bucket(context.resourceNames.cacheBucket, env);
  await ensureR2Bucket(context.resourceNames.storageBucket, env);

  if (context.previewSettings.state === 'valid') {
    if (!(await checkHyperdrive(context.previewSettings.hyperdriveId, env))) {
      throw new Error(
        `preview Hyperdrive id is configured but not accessible: ${context.previewSettings.hyperdriveId}`
      );
    }

    printStatus(
      'ok',
      'Hyperdrive config',
      context.previewSettings.hyperdriveId
    );
    return 0;
  }

  printStatus(
    'create',
    'Hyperdrive config',
    `aooi-${context.siteKey}-preview-db`
  );
  const result = await runWrangler(
    [
      'hyperdrive',
      'create',
      `aooi-${context.siteKey}-preview-db`,
      '--connection-string',
      context.previewDatabaseUrl,
      '--sslmode',
      'require',
    ],
    env
  );
  assertWranglerSuccess('create Hyperdrive config', result, [
    context.previewDatabaseUrl,
  ]);

  const hyperdriveId = parseHyperdriveIdFromOutput(result.output);
  if (!hyperdriveId) {
    const output = redactValues(stripAnsi(result.output).trim(), [
      context.previewDatabaseUrl,
    ]);
    throw new Error(
      `created Hyperdrive config but could not read its id from Wrangler output${output ? `:\n${output}` : ''}`
    );
  }

  writeFileSync(
    context.previewSettings.filePath,
    buildPreviewDeploySettingsJson(hyperdriveId),
    'utf8'
  );
  printStatus(
    'ok',
    'preview deploy settings',
    relativePath(context.rootDir, context.previewSettings.filePath)
  );
  printStatus('ok', 'Hyperdrive config', hyperdriveId);
  return 0;
}

async function runDeploy() {
  const context = createPreviewContext();
  requirePreviewOperatorValues(context);
  if (context.previewSettings.state !== 'valid') {
    throw new Error(
      `valid sites/${context.siteKey}/deploy.preview.settings.json is required before preview deploy`
    );
  }

  const env = createPreviewCommandEnv(context);
  const steps = [
    ['migrate preview database', ['db:migrate']],
    ['check preview config', ['cf:preview:check']],
    ['build preview workers', ['cf:preview:build']],
    ['deploy preview state worker', ['cf:preview:deploy:state']],
    ['bootstrap preview app workers', ['cf:preview:bootstrap']],
  ];

  for (const [label, args] of steps) {
    printStatus('run', label, `pnpm ${args.join(' ')}`);
    const code = await runPnpmInherit(args, env);
    if (code !== 0) {
      throw new Error(`${label} failed with exit code ${code}`);
    }
  }

  printStatus('ok', 'preview URL', context.resourceNames.routerOrigin);
  return 0;
}

async function main() {
  const mode = process.argv[2];
  if (!PREVIEW_MODE_CHOICES.includes(mode)) {
    console.error(
      `Usage: SITE=<site-key> pnpm site:preview:<doctor|provision|deploy>`
    );
    process.exit(1);
  }

  const exitCode =
    mode === 'doctor'
      ? await runDoctor()
      : mode === 'provision'
        ? await runProvision()
        : await runDeploy();
  process.exit(exitCode);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
