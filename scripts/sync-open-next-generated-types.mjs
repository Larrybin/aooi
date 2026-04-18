import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATED_DECLARATIONS_PATH = path.resolve(
  process.cwd(),
  'src/shared/types/open-next-generated.d.ts'
);
const CLOUDFLARE_WORKERS_DIR = path.resolve(process.cwd(), 'cloudflare/workers');

const DECLARATION_BLOCK_PATTERN =
  /declare module '([^']+)' \{\n([\s\S]*?)\n\}/g;

function resolveOutputDeclarationPath(moduleSpecifier) {
  if (moduleSpecifier.endsWith('.mjs')) {
    return moduleSpecifier.replace(/\.mjs$/, '.d.mts');
  }

  if (moduleSpecifier.endsWith('.js')) {
    return moduleSpecifier.replace(/\.js$/, '.d.ts');
  }

  throw new Error(
    `Unsupported OpenNext module declaration target: ${moduleSpecifier}`
  );
}

export async function readOpenNextGeneratedModules(
  declarationsPath = GENERATED_DECLARATIONS_PATH
) {
  const source = await readFile(declarationsPath, 'utf8');
  const modules = [];

  for (const match of source.matchAll(DECLARATION_BLOCK_PATTERN)) {
    const moduleSpecifier = match[1];
    const body = match[2]?.trim();

    if (!moduleSpecifier || !body) {
      continue;
    }

    modules.push({
      moduleSpecifier,
      outputRelativePath: path.relative(
        process.cwd(),
        path.resolve(
          CLOUDFLARE_WORKERS_DIR,
          resolveOutputDeclarationPath(moduleSpecifier)
        )
      ),
      source: `${body}\n`,
    });
  }

  return modules;
}

export async function syncOpenNextGeneratedTypes(rootDir = process.cwd()) {
  const modules = await readOpenNextGeneratedModules();

  await Promise.all(
    modules.map(async ({ outputRelativePath, source }) => {
      const outputPath = path.resolve(rootDir, outputRelativePath);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, source, 'utf8');
    })
  );

  return modules;
}

const entryScriptPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : null;

if (
  entryScriptPath &&
  path.resolve(fileURLToPath(import.meta.url)) === entryScriptPath
) {
  syncOpenNextGeneratedTypes().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
