import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = process.cwd();
const acceptanceWorkflowPath = path.resolve(
  rootDir,
  '.github/workflows/cloudflare-acceptance.yaml'
);
const productionDeployWorkflowPath = path.resolve(
  rootDir,
  '.github/workflows/cloudflare-production-deploy.yaml'
);
const productionMigrateWorkflowPath = path.resolve(
  rootDir,
  '.github/workflows/cloudflare-production-migrate.yaml'
);
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8')
) as {
  scripts: Record<string, string>;
};
const acceptanceWorkflowContent = fs.readFileSync(
  acceptanceWorkflowPath,
  'utf8'
);
const readmeContent = fs.readFileSync(
  path.resolve(rootDir, 'README.md'),
  'utf8'
);
const deployGovernanceContent = fs.readFileSync(
  path.resolve(
    rootDir,
    'docs/architecture/cloudflare-deployment-governance.md'
  ),
  'utf8'
);
const deploymentGuideContent = fs.readFileSync(
  path.resolve(rootDir, 'docs/guides/deployment.md'),
  'utf8'
);

test('GitHub Actions 不再拥有生产发布 workflow', () => {
  assert.equal(fs.existsSync(productionDeployWorkflowPath), false);
  assert.equal(fs.existsSync(productionMigrateWorkflowPath), false);
});

test('Cloudflare acceptance 拆分职责并保留稳定 required check', () => {
  assert.match(
    acceptanceWorkflowContent,
    /^name:\s*Cloudflare Deploy Acceptance/m
  );
  assert.match(acceptanceWorkflowContent, /name:\s*cloudflare acceptance/);
  assert.match(acceptanceWorkflowContent, /ci-static:/);
  assert.match(acceptanceWorkflowContent, /name:\s*ci static/);
  assert.match(acceptanceWorkflowContent, /Run lint[\s\S]*?run:\s*pnpm lint/);
  assert.match(
    acceptanceWorkflowContent,
    /Run architecture gate[\s\S]*?run:\s*pnpm arch:check/
  );
  assert.match(
    acceptanceWorkflowContent,
    /Run unit tests[\s\S]*?run:\s*pnpm test/
  );
  assert.match(
    acceptanceWorkflowContent,
    /Run schema migration guard[\s\S]*?check-release-inputs\.mjs/
  );
  assert.match(
    acceptanceWorkflowContent,
    /Detect Cloudflare acceptance changes[\s\S]*?detect-cloudflare-acceptance-changes\.mjs/
  );
  assert.match(
    acceptanceWorkflowContent,
    /Run Cloudflare config gate[\s\S]*?run:\s*pnpm cf:check/
  );
  assert.match(
    acceptanceWorkflowContent,
    /Run Cloudflare build gate[\s\S]*?run:\s*pnpm cf:build/
  );
  assert.match(
    acceptanceWorkflowContent,
    /Checkout repository[\s\S]*?fetch-depth:\s*0/
  );
  assert.match(
    acceptanceWorkflowContent,
    /strategy:[\s\S]*?matrix:[\s\S]*?site:\s*\[mamamiya, ai-remover\]/
  );
  assert.match(
    acceptanceWorkflowContent,
    /SITE=ai-remover pnpm contract:check/
  );
  assert.match(acceptanceWorkflowContent, /const expected = \{/);
  assert.match(
    acceptanceWorkflowContent,
    /cloudflare_changed[\s\S]*?results\[key\] !== 'success'/
  );
  assert.match(
    acceptanceWorkflowContent,
    /contract_ai_remover_changed[\s\S]*?results\[key\] !== 'success'/
  );
  assert.match(acceptanceWorkflowContent, /CREEM_API_KEY:/);
  assert.match(acceptanceWorkflowContent, /CREEM_SIGNING_SECRET:/);
  assert.match(acceptanceWorkflowContent, /GOOGLE_CLIENT_ID:/);
  assert.match(acceptanceWorkflowContent, /GOOGLE_CLIENT_SECRET:/);
  assert.match(acceptanceWorkflowContent, /OPENROUTER_API_KEY:/);
  assert.match(acceptanceWorkflowContent, /REMOVER_CLEANUP_SECRET:/);
  assert.doesNotMatch(
    acceptanceWorkflowContent,
    /services:\s*[\s\S]*postgres:/
  );
  assert.doesNotMatch(
    acceptanceWorkflowContent,
    /Run database migrations[\s\S]*?pnpm db:migrate/
  );
  assert.doesNotMatch(acceptanceWorkflowContent, /release-metadata/);
  assert.doesNotMatch(acceptanceWorkflowContent, /actions\/upload-artifact/);
});

test('package 暴露本地 Cloudflare production release 入口', () => {
  assert.equal(
    packageJson.scripts['release:cf'],
    'node --import tsx scripts/run-local-cloudflare-release.mjs'
  );
});

test('文档声明本地 operator session 是生产发布权威', () => {
  assert.match(
    readmeContent,
    /GitHub Actions is the Cloudflare acceptance gate, not the production deploy authority/
  );
  assert.match(
    deployGovernanceContent,
    /Production release authority belongs to the local operator session/
  );
  assert.match(deploymentGuideContent, /SITE=mamamiya pnpm release:cf/);
  assert.match(deploymentGuideContent, /RELEASE_TEST_DATABASE_URL/);
  assert.match(deploymentGuideContent, /PRODUCTION_DATABASE_URL/);
  assert.match(deploymentGuideContent, /\.env\.production/);
});
