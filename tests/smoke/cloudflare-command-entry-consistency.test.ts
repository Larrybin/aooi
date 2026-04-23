import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CLOUDFLARE_COMMAND_ENTRYPOINTS,
  findStaticWranglerPathBypass,
} from '../../scripts/lib/cloudflare-command-entrypoints.mjs';

test('关键 Cloudflare 命令入口不得内联静态 wrangler 路径绕过 shared resolver', async () => {
  for (const relativePath of CLOUDFLARE_COMMAND_ENTRYPOINTS) {
    const source = await readFile(relativePath, 'utf8');
    assert.equal(
      findStaticWranglerPathBypass(source),
      false,
      `${relativePath} still contains a static wrangler config bypass`
    );
  }
});
