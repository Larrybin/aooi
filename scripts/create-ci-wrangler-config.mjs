import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = process.cwd();

function escapeTomlBasicString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function replaceQuotedValue(content, pattern, nextValue, label) {
  if (!pattern.test(content)) {
    throw new Error(`missing ${label} in wrangler config template`);
  }

  return content.replace(pattern, `$1${escapeTomlBasicString(nextValue)}$3`);
}

export function buildCiWranglerConfig({
  template,
  databaseUrl,
  appUrl,
  deployTarget = 'cloudflare',
}) {
  let nextContent = replaceQuotedValue(
    template,
    /(^\s*localConnectionString\s*=\s*")([^"\n]*)(")/m,
    databaseUrl,
    '[[hyperdrive]].localConnectionString'
  );

  nextContent = replaceQuotedValue(
    nextContent,
    /(^\s*NEXT_PUBLIC_APP_URL\s*=\s*")([^"\n]*)(")/m,
    appUrl,
    'vars.NEXT_PUBLIC_APP_URL'
  );

  nextContent = replaceQuotedValue(
    nextContent,
    /(^\s*DEPLOY_TARGET\s*=\s*")([^"\n]*)(")/m,
    deployTarget,
    'vars.DEPLOY_TARGET'
  );

  return nextContent;
}

async function main() {
  const args = process.argv.slice(2);
  const outArg = args.find((arg) => arg.startsWith('--out='));
  const templateArg = args.find((arg) => arg.startsWith('--template='));
  const databaseUrlArg = args.find((arg) => arg.startsWith('--database-url='));
  const appUrlArg = args.find((arg) => arg.startsWith('--app-url='));
  const deployTargetArg = args.find((arg) =>
    arg.startsWith('--deploy-target=')
  );

  const outputPath =
    outArg?.split('=')[1] ||
    path.resolve(rootDir, '.tmp/wrangler.cloudflare.ci.toml');
  const templatePath =
    templateArg?.split('=')[1] ||
    path.resolve(rootDir, 'wrangler.cloudflare.toml');
  const databaseUrl =
    databaseUrlArg?.split('=')[1] ||
    process.env.AUTH_SPIKE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  const appUrl =
    appUrlArg?.split('=')[1] ||
    process.env.CF_PREVIEW_APP_URL?.trim() ||
    'http://127.0.0.1:8787';
  const deployTarget =
    deployTargetArg?.split('=')[1] ||
    process.env.DEPLOY_TARGET?.trim() ||
    'cloudflare';

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required to build CI Wrangler config'
    );
  }

  const template = await readFile(templatePath, 'utf8');
  const nextConfig = buildCiWranglerConfig({
    template,
    databaseUrl,
    appUrl,
    deployTarget,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, nextConfig, 'utf8');
  process.stdout.write(`${outputPath}\n`);
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
