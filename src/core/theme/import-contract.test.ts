import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import test from 'node:test';

const SOURCE_ROOT = resolve(process.cwd(), 'src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(absolutePath)));
      continue;
    }

    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

test('theme: 仓库源码不再引用 legacy landing 入口', async () => {
  const legacyImport = '@/core/theme' + '/landing';
  const sourceFiles = await collectSourceFiles(SOURCE_ROOT);
  const matchedFiles: string[] = [];

  for (const filePath of sourceFiles) {
    const content = await readFile(filePath, 'utf8');
    if (content.includes(legacyImport)) {
      matchedFiles.push(filePath);
    }
  }

  assert.deepEqual(matchedFiles, []);
});
