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

test('Cloudflare acceptance 只做验收且不上传 release metadata', () => {
  assert.match(acceptanceWorkflowContent, /Run lint[\s\S]*?run:\s*pnpm lint/);
  assert.match(
    acceptanceWorkflowContent,
    /Run architecture gate[\s\S]*?run:\s*pnpm arch:check/
  );
  assert.match(
    acceptanceWorkflowContent,
    /Run unit and contract tests[\s\S]*?run:\s*pnpm test/
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
    /Run release input guard[\s\S]*?check-release-inputs\.mjs/
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
