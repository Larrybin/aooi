import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = process.cwd();

export const NO_DB_CLOUDFLARE_BUILD_SITES = Object.freeze([
  'mamamiya',
  'ai-remover',
]);

export const NO_DB_CLOUDFLARE_PLACEHOLDER_ENV = Object.freeze({
  BETTER_AUTH_SECRET: 'ci-auth-secret-not-for-production',
  AUTH_SECRET: 'ci-auth-secret-not-for-production',
  RESEND_API_KEY: 'ci-resend-api-key-not-for-production',
  STORAGE_PUBLIC_BASE_URL: 'http://127.0.0.1:8787/assets/',
  CREEM_API_KEY: 'ci-creem-api-key-not-for-production',
  CREEM_SIGNING_SECRET: 'ci-creem-signing-secret-not-for-production',
  GOOGLE_CLIENT_ID: 'ci-google-client-id-not-for-production',
  GOOGLE_CLIENT_SECRET: 'ci-google-client-secret-not-for-production',
  OPENROUTER_API_KEY: 'ci-openrouter-api-key-not-for-production',
  REMOVER_CLEANUP_SECRET: 'ci-remover-cleanup-secret-not-for-production',
});

export function buildNoDbCloudflareBuildCommandArgs(scriptArgs = []) {
  return ['cf:build', ...scriptArgs];
}

export function buildNoDbCloudflareBuildEnv(site, baseEnv = process.env) {
  return {
    ...baseEnv,
    ...NO_DB_CLOUDFLARE_PLACEHOLDER_ENV,
    SITE: site,
    DEPLOY_TARGET: 'cloudflare',
    DATABASE_PROVIDER: 'postgresql',
    DATABASE_URL: '',
    AUTH_SPIKE_DATABASE_URL: '',
  };
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(' ')} exited with code ${code ?? 1}`
          )
        );
        return;
      }

      resolve(undefined);
    });
  });
}

export async function runNoDbCloudflareBuilds({
  sites = NO_DB_CLOUDFLARE_BUILD_SITES,
  scriptArgs = [],
  baseEnv = process.env,
  runSiteBuild = async ({ args, env }) => runCommand('pnpm', args, env),
  logger = console,
} = {}) {
  const results = [];

  for (const site of sites) {
    const args = buildNoDbCloudflareBuildCommandArgs(scriptArgs);
    const env = buildNoDbCloudflareBuildEnv(site, baseEnv);
    logger.log(`[cf:build:no-db] ${site}: start`);

    try {
      await runSiteBuild({ site, args, env });
      results.push({ site, status: 'passed' });
      logger.log(`[cf:build:no-db] ${site}: passed`);
    } catch (error) {
      const message = getErrorMessage(error);
      results.push({ site, status: 'failed', message });
      logger.error(`[cf:build:no-db] ${site}: failed`);
      logger.error(message);
    }
  }

  return results;
}

export function printNoDbCloudflareBuildSummary(results, logger = console) {
  logger.log('');
  logger.log('[cf:build:no-db] Summary');

  for (const result of results) {
    const label = result.status === 'passed' ? 'ok  ' : 'fail';
    const suffix = result.message ? ` - ${result.message}` : '';
    logger.log(`  ${label}  ${result.site}${suffix}`);
  }
}

async function main() {
  const results = await runNoDbCloudflareBuilds({
    scriptArgs: process.argv.slice(2),
  });
  printNoDbCloudflareBuildSummary(results);

  if (results.some((result) => result.status === 'failed')) {
    process.exit(1);
  }
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
