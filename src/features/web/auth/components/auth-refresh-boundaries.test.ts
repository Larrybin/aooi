import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../..');

async function readRepoFile(relativePath: string) {
  return readFile(path.resolve(repoRoot, relativePath), 'utf8');
}

test('登录登出关键路径会触发 router.refresh 以同步轻快照', async () => {
  const filesToCheck = [
    'src/features/web/auth/components/sign-in-form.tsx',
    'src/features/web/auth/components/sign-user.tsx',
    'src/shared/blocks/workspace/sidebar-user.tsx',
  ];

  for (const file of filesToCheck) {
    const content = await readRepoFile(file);
    assert.equal(content.includes('router.refresh('), true, file);
  }
});
