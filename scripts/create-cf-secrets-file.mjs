import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = process.cwd();

export const CLOUDFLARE_SECRET_NAMES = [
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
];

export function resolveCloudflareAuthSecretValue(
  processEnv = process.env,
  { fallbackAuthSecret } = {}
) {
  const betterAuthSecret = processEnv.BETTER_AUTH_SECRET?.trim();
  if (betterAuthSecret) {
    return betterAuthSecret;
  }

  const authSecret = processEnv.AUTH_SECRET?.trim();
  if (authSecret) {
    return authSecret;
  }

  if (fallbackAuthSecret?.trim()) {
    return fallbackAuthSecret.trim();
  }

  throw new Error(
    'BETTER_AUTH_SECRET or AUTH_SECRET is required to build Cloudflare secrets'
  );
}

export function buildCloudflareSecretsEnv(processEnv = process.env, options = {}) {
  const authSecret = resolveCloudflareAuthSecretValue(processEnv, options);

  return `${CLOUDFLARE_SECRET_NAMES.map((name) => `${name}=${processEnv[name]?.trim() || authSecret}`).join('\n')}\n`;
}

export async function writeCloudflareSecretsFile({
  outputPath = path.resolve(rootDir, '.tmp/cloudflare.secrets.env'),
  processEnv = process.env,
  fallbackAuthSecret,
} = {}) {
  const content = buildCloudflareSecretsEnv(processEnv, { fallbackAuthSecret });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, 'utf8');

  return {
    outputPath,
    content,
  };
}

async function main() {
  const outArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--out='));
  const outputPath = outArg
    ? path.resolve(rootDir, outArg.split('=')[1])
    : path.resolve(rootDir, '.tmp/cloudflare.secrets.env');
  const result = await writeCloudflareSecretsFile({ outputPath });
  process.stdout.write(`${result.outputPath}\n`);
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
