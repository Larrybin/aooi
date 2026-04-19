import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = process.cwd();
const REQUIRED_INCREMENTAL_CACHE_BINDING = 'NEXT_INC_CACHE_R2_BUCKET';
const REQUIRED_APP_STORAGE_BINDING = 'APP_STORAGE_R2_BUCKET';
const REQUIRED_STATEFUL_LIMITERS_BINDING = 'STATEFUL_LIMITERS';

function readArrayTables(content, tableName) {
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
  return content.match(pattern)?.[1] ?? null;
}

function hasQuotedValue(content, pattern, expectedValue) {
  const match = content.match(pattern);
  return match?.[1] === expectedValue;
}

function assertTemplateContract(content, templatePath) {
  const label = path.relative(rootDir, templatePath) || templatePath;
  const r2Buckets = readArrayTables(content, 'r2_buckets');
  const doBindings = readArrayTables(content, 'durable_objects.bindings');
  const imagesSection = readSection(content, 'images');

  if (
    !r2Buckets.some((table) =>
      hasQuotedValue(
        table,
        /^\s*binding\s*=\s*"([^"\n]+)"/m,
        REQUIRED_INCREMENTAL_CACHE_BINDING
      )
    )
  ) {
    throw new Error(
      `${label} must declare [[r2_buckets]] binding = "${REQUIRED_INCREMENTAL_CACHE_BINDING}"`
    );
  }

  if (
    !r2Buckets.some((table) =>
      hasQuotedValue(
        table,
        /^\s*binding\s*=\s*"([^"\n]+)"/m,
        REQUIRED_APP_STORAGE_BINDING
      )
    )
  ) {
    throw new Error(
      `${label} must declare [[r2_buckets]] binding = "${REQUIRED_APP_STORAGE_BINDING}"`
    );
  }

  if (
    !doBindings.some((table) =>
      hasQuotedValue(
        table,
        /^\s*name\s*=\s*"([^"\n]+)"/m,
        REQUIRED_STATEFUL_LIMITERS_BINDING
      )
    )
  ) {
    throw new Error(
      `${label} must declare [[durable_objects.bindings]] name = "${REQUIRED_STATEFUL_LIMITERS_BINDING}"`
    );
  }

  if (
    !hasQuotedValue(
      content,
      /^\s*DEPLOY_TARGET\s*=\s*"([^"\n]+)"/m,
      'cloudflare'
    )
  ) {
    throw new Error(`${label} must pin DEPLOY_TARGET = "cloudflare"`);
  }

  if (imagesSection) {
    if (
      !hasQuotedValue(
        imagesSection,
        /^\s*binding\s*=\s*"([^"\n]+)"/m,
        'IMAGES'
      )
    ) {
      throw new Error(`${label} must declare [images] binding = "IMAGES"`);
    }
  }
}

function escapeTomlBasicString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function replaceQuotedValue(content, pattern, nextValue, label) {
  if (!pattern.test(content)) {
    throw new Error(`missing ${label} in wrangler config template`);
  }

  return content.replace(pattern, `$1${escapeTomlBasicString(nextValue)}$3`);
}

function normalizeTomlPath(value) {
  return value.split(path.sep).join('/');
}

function rebaseRelativeTomlPath({
  content,
  pattern,
  label,
  templatePath,
  outputPath,
}) {
  const match = content.match(pattern);
  if (!match?.[2]) {
    throw new Error(`missing ${label} in wrangler config template`);
  }

  const currentPath = match[2];
  if (path.isAbsolute(currentPath)) {
    return content;
  }

  const rebasedPath = normalizeTomlPath(
    path.relative(
      path.dirname(outputPath),
      path.resolve(path.dirname(templatePath), currentPath)
    )
  );

  return content.replace(pattern, `$1${escapeTomlBasicString(rebasedPath)}$3`);
}

function replaceVersionVars(content, versionVars) {
  let nextContent = content;

  for (const [key, value] of Object.entries(versionVars)) {
    nextContent = replaceQuotedValue(
      nextContent,
      new RegExp(`(^\\s*${key}\\s*=\\s*")([^"\\n]*)(")`, 'm'),
      value,
      `vars.${key}`
    );
  }

  return nextContent;
}

function upsertTomlTableStringValue(content, tableName, key, value) {
  const lines = content.split('\n');
  const tableHeader = `[${tableName}]`;
  const entryLine = `${key} = "${escapeTomlBasicString(value)}"`;
  const tableIndex = lines.findIndex((line) => line.trim() === tableHeader);

  if (tableIndex === -1) {
    if (lines.at(-1) !== '') {
      lines.push('');
    }

    lines.push(tableHeader, entryLine);
    return lines.join('\n');
  }

  let tableEndIndex = lines.length;
  for (let index = tableIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim().startsWith('[')) {
      tableEndIndex = index;
      break;
    }
  }

  for (let index = tableIndex + 1; index < tableEndIndex; index += 1) {
    if (lines[index].trim().startsWith(`${key} = `)) {
      lines[index] = entryLine;
      return lines.join('\n');
    }
  }

  lines.splice(tableEndIndex, 0, entryLine);
  return lines.join('\n');
}

export function buildCloudflareWranglerConfig({
  template,
  databaseUrl,
  appUrl,
  deployTarget,
  devHost,
  devUpstreamProtocol,
  templatePath,
  outputPath,
  versionVars = {},
  validateTemplateContract = false,
}) {
  if (
    validateTemplateContract &&
    existsSync(templatePath) &&
    path.resolve(templatePath).startsWith(`${rootDir}${path.sep}`)
  ) {
    assertTemplateContract(template, templatePath);
  }

  let nextContent = template;

  if (databaseUrl !== undefined) {
    nextContent = replaceQuotedValue(
      nextContent,
      /(^\s*localConnectionString\s*=\s*")([^"\n]*)(")/m,
      databaseUrl,
      '[[hyperdrive]].localConnectionString'
    );
  }

  if (appUrl !== undefined) {
    nextContent = replaceQuotedValue(
      nextContent,
      /(^\s*NEXT_PUBLIC_APP_URL\s*=\s*")([^"\n]*)(")/m,
      appUrl,
      'vars.NEXT_PUBLIC_APP_URL'
    );
  }

  if (deployTarget !== undefined) {
    nextContent = replaceQuotedValue(
      nextContent,
      /(^\s*DEPLOY_TARGET\s*=\s*")([^"\n]*)(")/m,
      deployTarget,
      'vars.DEPLOY_TARGET'
    );
  }

  nextContent = replaceVersionVars(nextContent, versionVars);

  if (devHost !== undefined) {
    nextContent = upsertTomlTableStringValue(nextContent, 'dev', 'host', devHost);
  }

  if (devUpstreamProtocol !== undefined) {
    nextContent = upsertTomlTableStringValue(
      nextContent,
      'dev',
      'upstream_protocol',
      devUpstreamProtocol
    );
  }

  nextContent = rebaseRelativeTomlPath({
    content: nextContent,
    pattern: /(^\s*main\s*=\s*")([^"\n]*)(")/m,
    label: 'main',
    templatePath,
    outputPath,
  });

  nextContent = rebaseRelativeTomlPath({
    content: nextContent,
    pattern: /(^\s*directory\s*=\s*")([^"\n]*)(")/m,
    label: 'assets.directory',
    templatePath,
    outputPath,
  });

  return nextContent;
}

function parseArgs(argv) {
  const options = {
    out: path.resolve(rootDir, '.tmp/wrangler.cloudflare.generated.toml'),
    template: path.resolve(rootDir, 'wrangler.cloudflare.toml'),
    databaseUrl:
      process.env.AUTH_SPIKE_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim(),
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim(),
    deployTarget: process.env.DEPLOY_TARGET?.trim(),
    devHost: process.env.CF_LOCAL_DEV_HOST?.trim(),
    devUpstreamProtocol: process.env.CF_LOCAL_DEV_UPSTREAM_PROTOCOL?.trim(),
    versionVars: {},
  };

  for (const arg of argv) {
    if (arg.startsWith('--out=')) {
      options.out = path.resolve(rootDir, arg.split('=')[1]);
      continue;
    }

    if (arg.startsWith('--template=')) {
      options.template = path.resolve(rootDir, arg.split('=')[1]);
      continue;
    }

    if (arg.startsWith('--database-url=')) {
      options.databaseUrl = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--app-url=')) {
      options.appUrl = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--deploy-target=')) {
      options.deployTarget = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--dev-host=')) {
      options.devHost = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--dev-upstream-protocol=')) {
      options.devUpstreamProtocol = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--var=')) {
      const raw = arg.slice('--var='.length);
      const separatorIndex = raw.indexOf('=');
      if (separatorIndex <= 0) {
        throw new Error(`invalid --var value: ${raw}`);
      }

      const key = raw.slice(0, separatorIndex);
      const value = raw.slice(separatorIndex + 1);
      options.versionVars[key] = value;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const template = await readFile(options.template, 'utf8');
  const nextConfig = buildCloudflareWranglerConfig({
    template,
    databaseUrl: options.databaseUrl,
    appUrl: options.appUrl,
    deployTarget: options.deployTarget,
    devHost: options.devHost,
    devUpstreamProtocol: options.devUpstreamProtocol,
    templatePath: options.template,
    outputPath: options.out,
    versionVars: options.versionVars,
    validateTemplateContract: true,
  });

  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(options.out, nextConfig, 'utf8');
  process.stdout.write(`${options.out}\n`);
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
