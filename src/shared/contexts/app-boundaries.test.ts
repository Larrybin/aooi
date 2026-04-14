import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

async function readRepoFile(relativePath: string) {
  return readFile(path.resolve(repoRoot, relativePath), 'utf8');
}

test('PublicAppProvider 不再在公共壳层读取 session、details 或 configs fallback', async () => {
  const content = await readRepoFile('src/shared/contexts/app.tsx');

  assert.equal(content.includes('useSession('), false);
  assert.equal(content.includes('/api/config/get-configs'), false);
  assert.equal(content.includes('get-user-info'), false);
});

test('公共 layout 都必须向 PublicAppProvider 注入 initialConfigs', async () => {
  const layoutFiles = [
    'src/themes/default/layouts/landing-marketing.tsx',
    'src/app/[locale]/(landing)/pricing/layout.tsx',
    'src/app/[locale]/(landing)/blog/layout.tsx',
    'src/app/[locale]/(landing)/activity/layout.tsx',
    'src/app/[locale]/(landing)/(ai)/layout.tsx',
    'src/app/[locale]/(landing)/settings/layout.tsx',
    'src/app/[locale]/(landing)/[slug]/layout.tsx',
    'src/app/[locale]/(chat)/layout.tsx',
    'src/app/[locale]/(admin)/layout.tsx',
  ];

  for (const layoutFile of layoutFiles) {
    const content = await readRepoFile(layoutFile);
    assert.equal(
      content.includes('<PublicAppProvider initialConfigs={publicConfigs}>'),
      true,
      `${layoutFile} 必须传入 initialConfigs`
    );
  }
});

test('仓库源码不再引用旧的 get-user-info 路径', async () => {
  const filesToCheck = [
    'src/shared/contexts/app.tsx',
    'src/themes/default/blocks/pricing.tsx',
    'src/shared/blocks/generator/image.tsx',
    'src/shared/blocks/generator/music.tsx',
  ];

  for (const file of filesToCheck) {
    const content = await readRepoFile(file);
    assert.equal(content.includes('/api/user/get-user-info'), false, file);
  }
});

test('公共消费方不再在首屏隐式读取 useSession', async () => {
  const filesToCheck = [
    'src/themes/default/blocks/pricing.tsx',
    'src/shared/blocks/generator/image.tsx',
    'src/shared/blocks/generator/music.tsx',
  ];

  for (const file of filesToCheck) {
    const content = await readRepoFile(file);
    assert.equal(content.includes('useSession('), false, file);
  }
});
