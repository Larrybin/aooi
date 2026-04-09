import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRODUCT_MODULES,
  PRODUCT_MODULE_GUIDE_REPO_BASE_URL,
  getProductModuleGuideHref,
} from './index';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function resolveGuidePathFromSlug(docSlug: string) {
  if (docSlug.startsWith('module-contract#')) {
    return path.resolve(rootDir, 'docs/guides/module-contract.md');
  }

  return path.resolve(rootDir, `docs/guides/${docSlug}.md`);
}

test('README: links to module contract guide', async () => {
  const readme = await readFile(path.resolve(rootDir, 'README.md'), 'utf8');

  assert.match(readme, /docs\/guides\/module-contract\.md/);
});

test('module docs: all module doc slugs resolve to real files', async () => {
  for (const productModule of PRODUCT_MODULES) {
    const guidePath = resolveGuidePathFromSlug(productModule.docSlug);
    const content = await readFile(guidePath, 'utf8');

    assert.ok(content.length > 0, `${productModule.id} guide is empty`);

    if (productModule.docSlug.startsWith('module-contract#')) {
      const anchor = productModule.docSlug.split('#')[1];
      assert.match(
        content.toLowerCase(),
        new RegExp(`^## .*${anchor.replace(/-/g, ' ')}`, 'm')
      );
    }
  }
});

test('getProductModuleGuideHref: returns GitHub docs URLs', () => {
  for (const productModule of PRODUCT_MODULES) {
    const href = getProductModuleGuideHref(productModule);

    assert.match(href, new RegExp(`^${PRODUCT_MODULE_GUIDE_REPO_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(href, /\.md($|#)/);
  }
});

test('Settings guide: points back to module contract source of truth', async () => {
  const content = await readFile(
    path.resolve(rootDir, 'docs/guides/settings.md'),
    'utf8'
  );

  assert.match(content, /docs\/guides\/module-contract\.md/);
  assert.match(content, /single source of truth/i);
});
