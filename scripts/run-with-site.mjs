import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const TEST_SITE_KEY = 'dev-local';
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

if (args.length === 0) {
  process.stderr.write('Usage: node scripts/run-with-site.mjs <command> [...args]\n');
  process.exit(1);
}

const generateScript = resolve(process.cwd(), 'scripts', 'generate-site-module.mjs');

function joinCommand(parts) {
  return parts.join(' ').trim();
}

function requiresExplicitSite(commandParts) {
  const joinedCommand = joinCommand(commandParts);
  return SITE_REQUIRED_COMMANDS.some((prefix) => joinedCommand.startsWith(prefix));
}

function buildSiteEnv(commandParts, env = process.env) {
  const siteKey = env.SITE?.trim();
  if (siteKey) {
    return env;
  }

  if (requiresExplicitSite(commandParts)) {
    process.stderr.write(
      `SITE is required for this command. Use an explicit site key such as SITE=mamamiya ${joinCommand(commandParts)}\n`
    );
    process.exit(1);
  }

  return {
    ...env,
    SITE: TEST_SITE_KEY,
  };
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
