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
    /do_migration_changed:\s*\$\{\{\s*steps\.release\.outputs\.do_migration_changed\s*\}\}/
  );
  assert.match(
    workflowContent,
    /release_kind:\s*\$\{\{\s*steps\.release\.outputs\.release_kind\s*\}\}/
  );
});

test('cloudflare production workflow 在 db schema 变更时先运行 migrate-db', () => {
  assert.match(
    workflowContent,
    /migrate-db:\n[\s\S]*?if:\s*needs\.prepare-release\.outputs\.db_schema_changed == 'true'/
  );
});

test('cloudflare production workflow 的 migration 通道只运行 migration deploy', () => {
  assert.match(
    workflowContent,
    /deploy-do-migration:\n[\s\S]*?if:\s*>-\s*[\s\S]*?always\(\)\s*&&[\s\S]*?needs\.prepare-release\.outputs\.release_kind == 'migration'[\s\S]*?needs\.migrate-db\.result == 'skipped'[\s\S]*?run:\s*pnpm cf:deploy:migration/
  );
});

test('cloudflare production workflow 的 normal 通道只运行 normal rollout', () => {
  assert.match(
    workflowContent,
    /deploy-normal-rollout:\n[\s\S]*?if:\s*>-\s*[\s\S]*?always\(\)\s*&&[\s\S]*?needs\.prepare-release\.outputs\.release_kind == 'normal'[\s\S]*?needs\.migrate-db\.result == 'skipped'[\s\S]*?run:\s*pnpm cf:deploy:rollout/
  );
  assert.doesNotMatch(
    workflowContent,
    /run:\s*pnpm cf:deploy\s*$/m
  );
});
