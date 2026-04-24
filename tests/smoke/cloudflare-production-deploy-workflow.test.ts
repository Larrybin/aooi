import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workflowPath = path.resolve(
  process.cwd(),
  '.github/workflows/cloudflare-production-deploy.yaml'
);
const workflowContent = fs.readFileSync(workflowPath, 'utf8');

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
  assert.doesNotMatch(
    workflowContent,
    /cf:deploy:rollout|cf:deploy:migration/
  );
});
