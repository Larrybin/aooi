import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import siteEnvModule from '../src/config/site-env.cjs';
import {
  assertWranglerSuccess,
  checkHyperdrive,
  ensureR2Bucket,
  isValidHyperdriveId,
  parseHyperdriveIdFromOutput,
  printStatus,
  redactValues,
  runWrangler,
  stripAnsi,
  withCommandPathFallback,
} from './lib/cloudflare-provisioning.mjs';
import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './lib/site-config.mjs';
import {
  readSiteDeploySettings,
  resolveSiteDeploySettingsPath,
  validateSiteDeploySettings,
} from './lib/site-deploy-settings.mjs';

const { applySiteLocalEnvOverlay, readSiteLocalEnv, resolveSiteLocalEnvPath } =
  siteEnvModule;

const PRODUCTION_MODE_CHOICES = ['provision'];

function trimEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasOwnEnvValue(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function relativePath(rootDir, targetPath) {
  return path.relative(rootDir, targetPath) || '.';
}

function resolveOperatorValue({ envFileValues, name, processEnv }) {
  if (hasOwnEnvValue(processEnv, name)) {
    return trimEnvValue(processEnv[name]);
  }

  return trimEnvValue(envFileValues[name]);
}

export function isProductionHyperdrivePlaceholder(hyperdriveId) {
  return /^0{32}$/u.test(hyperdriveId) || /^0{31}[1-9a-f]$/u.test(hyperdriveId);
}

export function buildProductionHyperdriveName(siteKey) {
  return `aooi-${siteKey}-db`;
}

export function updateProductionDeploySettingsHyperdriveId(
  deploySettings,
  hyperdriveId
) {
  if (!isValidHyperdriveId(hyperdriveId)) {
    throw new Error(
      'production Hyperdrive id must be a 32-character lowercase hex value'
    );
  }

  return {
    ...deploySettings,
    resources: {
      ...deploySettings.resources,
      hyperdriveId,
    },
  };
}

export function buildProductionDeploySettingsJson({
  deploySettings,
  hyperdriveId,
  siteConfig,
}) {
  const nextSettings = updateProductionDeploySettingsHyperdriveId(
    deploySettings,
    hyperdriveId
  );
  validateSiteDeploySettings(nextSettings, { siteConfig });
  return `${JSON.stringify(nextSettings, null, 2)}\n`;
}

function createProductionCommandEnv({
  rootDir,
  siteKey,
  processEnv = process.env,
}) {
  const env = {
    ...processEnv,
    NODE_ENV: 'production',
    SITE: siteKey,
  };

  applySiteLocalEnvOverlay({
    env,
    originalEnv: processEnv,
    rootDir,
    siteKey,
  });

  return withCommandPathFallback(env, processEnv);
}

function createProductionContext({
  processEnv = process.env,
  rootDir = process.cwd(),
} = {}) {
  const siteKey = resolveRequiredSiteKey(processEnv);
  const siteConfig = readCurrentSiteConfig({ rootDir, siteKey });
  const deploySettings = readSiteDeploySettings({ rootDir, siteKey });
  const envFilePath = resolveSiteLocalEnvPath({ rootDir, siteKey });
  const envFileValues = readSiteLocalEnv({ rootDir, siteKey });

  return {
    deploySettings,
    deploySettingsPath: resolveSiteDeploySettingsPath({ rootDir, siteKey }),
    envFilePath,
    productionDatabaseUrl: resolveOperatorValue({
      envFileValues,
      name: 'PRODUCTION_DATABASE_URL',
      processEnv,
    }),
    rootDir,
    siteConfig,
    siteKey,
  };
}

function requireProductionOperatorValues(context) {
  const missing = [];
  if (!existsSync(context.envFilePath)) {
    missing.push(`sites/${context.siteKey}/.env.local`);
  }
  if (!context.productionDatabaseUrl) {
    missing.push('PRODUCTION_DATABASE_URL');
  }

  if (missing.length > 0) {
    throw new Error(
      `missing required production value(s): ${missing.join(', ')}`
    );
  }
}

function writeProductionDeploySettingsHyperdriveId(context, hyperdriveId) {
  writeFileSync(
    context.deploySettingsPath,
    buildProductionDeploySettingsJson({
      deploySettings: context.deploySettings,
      hyperdriveId,
      siteConfig: context.siteConfig,
    }),
    'utf8'
  );
  printStatus(
    'ok',
    'production deploy settings',
    relativePath(context.rootDir, context.deploySettingsPath)
  );
}

async function ensureProductionHyperdrive(context, env) {
  const currentHyperdriveId = context.deploySettings.resources.hyperdriveId;
  if (await checkHyperdrive(currentHyperdriveId, env)) {
    printStatus('ok', 'Hyperdrive config', currentHyperdriveId);
    return;
  }

  if (!isProductionHyperdrivePlaceholder(currentHyperdriveId)) {
    throw new Error(
      `configured production Hyperdrive id is not accessible: ${currentHyperdriveId}`
    );
  }

  const hyperdriveName = buildProductionHyperdriveName(context.siteKey);
  printStatus('create', 'Hyperdrive config', hyperdriveName);
  const result = await runWrangler(
    [
      'hyperdrive',
      'create',
      hyperdriveName,
      '--connection-string',
      context.productionDatabaseUrl,
      '--sslmode',
      'require',
    ],
    env
  );
  assertWranglerSuccess('create production Hyperdrive config', result, [
    context.productionDatabaseUrl,
  ]);

  const hyperdriveId = parseHyperdriveIdFromOutput(result.output);
  if (!hyperdriveId) {
    const output = redactValues(stripAnsi(result.output).trim(), [
      context.productionDatabaseUrl,
    ]);
    throw new Error(
      `created production Hyperdrive config but could not read its id from Wrangler output${output ? `:\n${output}` : ''}`
    );
  }

  writeProductionDeploySettingsHyperdriveId(context, hyperdriveId);
  printStatus('ok', 'Hyperdrive config', hyperdriveId);
}

async function runProvision() {
  const context = createProductionContext();
  requireProductionOperatorValues(context);
  const env = createProductionCommandEnv(context);
  const resources = context.deploySettings.resources;

  await ensureR2Bucket(resources.incrementalCacheBucket, env);
  await ensureR2Bucket(resources.appStorageBucket, env);
  await ensureProductionHyperdrive(context, env);
  printStatus('ok', 'production resource provisioning');
  return 0;
}

async function main() {
  const mode = process.argv[2];
  if (!PRODUCTION_MODE_CHOICES.includes(mode)) {
    console.error('Usage: SITE=<site-key> pnpm site:production:<provision>');
    process.exit(1);
  }

  const exitCode = await runProvision();
  process.exit(exitCode);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
