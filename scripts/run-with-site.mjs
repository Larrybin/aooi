import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const TEST_SITE_KEY = 'dev-local';
const TEST_AUTH_SHARED_SECRET = 'dev-local-auth-secret-dev-local-auth-secret';
const TEST_STORAGE_PUBLIC_BASE_URL = 'http://127.0.0.1:9787/assets/';
const SITE_REQUIRED_COMMANDS = [
  'pnpm exec next',
  'node scripts/next-build.mjs',
  'pnpm exec @better-auth/cli generate',
  'node --import tsx scripts/check-cloudflare-config.mjs',
  'pnpm exec opennextjs-cloudflare build',
  'node --import tsx scripts/smoke.mjs',
  'node --import tsx scripts/run-cf-app-deploy.mjs',
  'node --import tsx scripts/run-cf-state-deploy.mjs',
];
const CONTENT_GENERATION_REQUIRED_COMMANDS = [
  'pnpm exec next',
  'node scripts/next-build.mjs',
  'pnpm exec @better-auth/cli generate',
  'node --import tsx scripts/smoke.mjs',
  'node --import tsx scripts/run-cf-app-deploy.mjs',
  'node --import tsx scripts/run-cf-state-deploy.mjs',
];

if (args.length === 0) {
  process.stderr.write(
    'Usage: node scripts/run-with-site.mjs <command> [...args]\n'
  );
  process.exit(1);
}

const generateScript = resolve(
  process.cwd(),
  'scripts',
  'generate-site-module.mjs'
);
const generateContentScript = resolve(
  process.cwd(),
  'scripts',
  'generate-content-source-module.mjs'
);

function joinCommand(parts) {
  return parts.join(' ').trim();
}

function requiresExplicitSite(commandParts) {
  const joinedCommand = joinCommand(commandParts);
  return SITE_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

function requiresContentGeneration(commandParts) {
  const joinedCommand = joinCommand(commandParts);
  return CONTENT_GENERATION_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

function buildSiteEnv(commandParts, env = process.env) {
  const siteKey = env.SITE?.trim();
  if (siteKey) {
    if (siteKey !== TEST_SITE_KEY) {
      return env;
    }

    const nextEnv = {
      ...env,
      STORAGE_PUBLIC_BASE_URL:
        env.STORAGE_PUBLIC_BASE_URL?.trim() || TEST_STORAGE_PUBLIC_BASE_URL,
    };

    if (!nextEnv.BETTER_AUTH_SECRET?.trim() && !nextEnv.AUTH_SECRET?.trim()) {
      nextEnv.BETTER_AUTH_SECRET = TEST_AUTH_SHARED_SECRET;
      nextEnv.AUTH_SECRET = TEST_AUTH_SHARED_SECRET;
    }

    return nextEnv;
  }

  if (requiresExplicitSite(commandParts)) {
    process.stderr.write(
      `SITE is required for this command. Use an explicit site key such as SITE=mamamiya ${joinCommand(commandParts)}\n`
    );
    process.exit(1);
  }

  const nextEnv = {
    ...env,
    SITE: TEST_SITE_KEY,
    STORAGE_PUBLIC_BASE_URL: TEST_STORAGE_PUBLIC_BASE_URL,
    BETTER_AUTH_SECRET: TEST_AUTH_SHARED_SECRET,
    AUTH_SECRET: TEST_AUTH_SHARED_SECRET,
  };

  return nextEnv;
}

function runNodeScript(scriptPath, scriptArgs = [], env = process.env) {
  return new Promise((resolveExitCode) => {
    const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code, signal) => {
      if (typeof code === 'number') {
        resolveExitCode(code);
        return;
      }

      if (signal) {
        process.stderr.write(`Command terminated by signal: ${signal}\n`);
      }
      resolveExitCode(1);
    });
  });
}

async function main() {
  const command = args[0];
  const commandArgs = args.slice(1);
  const siteEnv = buildSiteEnv([command, ...commandArgs]);
  const generateExitCode = await runNodeScript(generateScript, [], siteEnv);
  if (generateExitCode !== 0) {
    process.exit(generateExitCode);
  }

  if (requiresContentGeneration([command, ...commandArgs])) {
    const generateContentExitCode = await runNodeScript(
      generateContentScript,
      [],
      siteEnv
    );
    if (generateContentExitCode !== 0) {
      process.exit(generateContentExitCode);
    }
  }

  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: siteEnv,
    shell: true,
  });

  child.on('exit', (code, signal) => {
    if (typeof code === 'number') {
      process.exit(code);
      return;
    }

    if (signal) {
      process.stderr.write(`Command terminated by signal: ${signal}\n`);
    }
    process.exit(1);
  });
}

await main();
