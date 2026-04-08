import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCiWranglerConfig } from '../../scripts/create-ci-wrangler-config.mjs';

test('buildCiWranglerConfig 注入 CI 数据库、preview app url 与 deploy target', () => {
  const template = `
[[hyperdrive]]
binding = "HYPERDRIVE"
id = ""
localConnectionString = "postgresql://local"

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "http://localhost:3000"
`;

  const config = buildCiWranglerConfig({
    template,
    databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/aooi',
    appUrl: 'http://127.0.0.1:8787',
    deployTarget: 'cloudflare',
  });

  assert.match(
    config,
    /localConnectionString = "postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/aooi"/
  );
  assert.match(config, /NEXT_PUBLIC_APP_URL = "http:\/\/127\.0\.0\.1:8787"/);
  assert.match(config, /DEPLOY_TARGET = "cloudflare"/);
});
