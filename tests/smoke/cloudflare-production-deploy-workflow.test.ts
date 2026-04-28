import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workflowPath = path.resolve(
  process.cwd(),
  '.github/workflows/cloudflare-production-deploy.yaml'
);
const acceptanceWorkflowPath = path.resolve(
  process.cwd(),
  '.github/workflows/cloudflare-acceptance.yaml'
);
const workflowContent = fs.readFileSync(workflowPath, 'utf8');
const acceptanceWorkflowContent = fs.readFileSync(
  acceptanceWorkflowPath,
  'utf8'
);
const readmeContent = fs.readFileSync(
  path.resolve(process.cwd(), 'README.md'),
  'utf8'
);
const deployGovernanceContent = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'docs/architecture/cloudflare-deployment-governance.md'
  ),
  'utf8'
);

test('cloudflare production workflow 导出双通道 release metadata', () => {
  assert.match(
    workflowContent,
    /db_schema_changed:\s*\$\{\{\s*steps\.release\.outputs\.db_schema_changed\s*\}\}/
  );
  assert.match(
    workflowContent,
    /state_changed:\s*\$\{\{\s*steps\.release\.outputs\.state_changed\s*\}\}/
  );
  assert.match(
    workflowContent,
    /state_migrations_changed:\s*\$\{\{\s*steps\.release\.outputs\.state_migrations_changed\s*\}\}/
  );
});

test('cloudflare production workflow 在 db schema 变更时先运行 migrate-db', () => {
  assert.match(
    workflowContent,
    /migrate-db:\n[\s\S]*?if:\s*needs\.prepare-release\.outputs\.db_schema_changed == 'true'/
  );
});

test('cloudflare production workflow 在 state 变更时先运行 state deploy', () => {
  assert.match(
    workflowContent,
    /deploy-state:\n[\s\S]*?if:\s*>-\s*[\s\S]*?always\(\)\s*&&[\s\S]*?needs\.prepare-release\.outputs\.state_changed == 'true'[\s\S]*?needs\.migrate-db\.result == 'skipped'[\s\S]*?run:\s*pnpm cf:deploy:state/
  );
  assert.match(
    workflowContent,
    /deploy-state:\n[\s\S]*?env:\n[\s\S]*?SITE:\s*mamamiya/
  );
});

test('cloudflare production workflow 总是以 app deploy 收尾', () => {
  assert.match(
    workflowContent,
    /deploy-app:\n[\s\S]*?needs:\s*\[prepare-release, migrate-db, deploy-state\][\s\S]*?run:\s*pnpm cf:deploy/
  );
  assert.match(
    workflowContent,
    /deploy-app:\n[\s\S]*?env:\n[\s\S]*?SITE:\s*mamamiya/
  );
  assert.doesNotMatch(workflowContent, /cf:deploy:rollout|cf:deploy:migration/);
});

test('cloudflare acceptance workflow 为 auth email provider 提供 CI binding', () => {
  assert.match(
    acceptanceWorkflowContent,
    /env:\n[\s\S]*?RESEND_API_KEY:\s*ci-resend-api-key-not-for-production[\s\S]*?Run Cloudflare config gate[\s\S]*?run:\s*pnpm cf:check/
  );
});

test('cloudflare production app deploy 注入 auth email provider secret', () => {
  assert.match(
    workflowContent,
    /deploy-app:\n[\s\S]*?env:\n[\s\S]*?RESEND_API_KEY:\s*\$\{\{\s*secrets\.RESEND_API_KEY\s*\}\}[\s\S]*?Deploy Cloudflare app workers[\s\S]*?run:\s*pnpm cf:deploy/
  );
});

test('cloudflare production workflow 在 app deploy 后显式运行生产 smoke', () => {
  assert.match(
    workflowContent,
    /Deploy Cloudflare app workers[\s\S]*?run:\s*pnpm cf:deploy[\s\S]*?Run production Cloudflare smoke[\s\S]*?run:\s*pnpm test:cf-app-smoke/
  );
});

test('cloudflare production governance 承认 GitHub Actions 是生产发布权威', () => {
  assert.match(
    readmeContent,
    /GitHub Actions is the authoritative production deploy channel/
  );
  assert.match(
    deployGovernanceContent,
    /Production deploy authority belongs to GitHub Actions/
  );
  assert.doesNotMatch(
    `${readmeContent}\n${deployGovernanceContent}`,
    /GitHub-side deploy workflows are non-authoritative|not a production deploy authority|release authority stays with the local operator session/
  );
});
