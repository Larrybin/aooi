import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import * as productModulesModule from '../src/config/product-modules/index.ts';
import {
  buildNodeAuthSpikeEnv,
  createNodeDevManager,
  detectReusableNodeServer,
  readWranglerLocalConnectionString,
  waitForNodeReady,
} from './run-local-auth-spike.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_PASSWORD = 'ModuleContract123!module';
const DEFAULT_NAME = 'Module Contract Smoke';
const DEFAULT_AUTH_SECRET = 'module-contract-smoke-secret-0123456789';
const productModules = productModulesModule.default ?? productModulesModule;
const { getProductModuleItemsByTab } = productModules;

function createTempEmail() {
  return `module-contract-smoke+${Date.now()}@example.com`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await canListenOnPort(port)) {
      return port;
    }
  }

  throw new Error(`No available local port found from ${startPort}`);
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return true;
  }

  const exitPromise = once(child, 'exit')
    .then(() => true)
    .catch(() => false);

  return Promise.race([exitPromise, sleep(timeoutMs).then(() => false)]);
}

function killChild(child, signal) {
  if (!child.pid) {
    return;
  }

  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // ignore
    }
  }

  child.kill(signal);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  killChild(child, 'SIGINT');
  const exited = await waitForChildExit(child, 10_000);
  if (!exited && child.exitCode === null) {
    killChild(child, 'SIGKILL');
    await waitForChildExit(child, 5_000);
  }
}

async function readLockedNodeInfo() {
  const lockPath = path.resolve(rootDir, '.next/dev/lock');

  try {
    const content = await readFile(lockPath, 'utf8');
    const parsed = JSON.parse(content);
    const appUrl =
      typeof parsed?.appUrl === 'string' ? parsed.appUrl.trim() : '';
    const pid =
      typeof parsed?.pid === 'number'
        ? parsed.pid
        : Number.parseInt(String(parsed?.pid || ''), 10);

    if (!appUrl || !Number.isInteger(pid) || pid <= 0) {
      return null;
    }

    return { appUrl, pid };
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getAdminSettingsModuleContractChecks(baseUrl = DEFAULT_BASE_URL) {
  const generalModules = getProductModuleItemsByTab('general');
  const authModules = getProductModuleItemsByTab('auth');
  const paymentModules = getProductModuleItemsByTab('payment');
  const aiModules = getProductModuleItemsByTab('ai');
  const contentModules = getProductModuleItemsByTab('content');
  const emailModules = getProductModuleItemsByTab('email');

  assert.equal(generalModules.length, 1);
  assert.equal(authModules.length, 1);
  assert.equal(paymentModules.length, 1);
  assert.equal(aiModules.length, 1);
  assert.equal(contentModules.length, 2);
  assert.equal(emailModules.length, 2);

  return [
    {
      name: 'general',
      path: '/admin/settings/general',
      expectedRows: generalModules.map((module) => ({
        moduleId: module.moduleId,
        title: module.title,
        relationship: 'Owned',
        tier: 'Mainline',
        verification: 'Verified',
        guideHref: module.guideHref,
      })),
    },
    {
      name: 'auth',
      path: '/admin/settings/auth',
      expectedRows: authModules.map((module) => ({
        moduleId: module.moduleId,
        title: module.title,
        relationship: 'Owned',
        tier: 'Mainline',
        verification: 'Partial',
        guideHref: module.guideHref,
      })),
    },
    {
      name: 'payment',
      path: '/admin/settings/payment',
      expectedRows: paymentModules.map((module) => ({
        moduleId: module.moduleId,
        title: module.title,
        relationship: 'Owned',
        tier: 'Mainline',
        verification: 'Partial',
        guideHref: module.guideHref,
      })),
    },
    {
      name: 'ai',
      path: '/admin/settings/ai',
      expectedRows: aiModules.map((module) => ({
        moduleId: module.moduleId,
        title: module.title,
        relationship: 'Owned',
        tier: 'Optional',
        verification: 'Partial',
        guideHref: module.guideHref,
      })),
    },
    {
      name: 'content',
      path: '/admin/settings/content',
      expectedRows: contentModules.map((module) => ({
        moduleId: module.moduleId,
        title: module.title,
        relationship: 'Owned',
        tier: 'Optional',
        verification: 'Partial',
        guideHref: module.guideHref,
      })),
    },
    {
      name: 'email',
      path: '/admin/settings/email',
      expectedRows: emailModules.map((module) => ({
        moduleId: module.moduleId,
        title: module.title,
        relationship: 'Supporting',
        tier: module.moduleId === 'auth' ? 'Mainline' : 'Optional',
        verification: module.moduleId === 'auth' ? 'Partial' : 'Unverified',
        guideHref: module.guideHref,
      })),
    },
  ].map((check) => ({ ...check, baseUrl }));
}

export function validateAdminSettingsModuleContractSnapshot(check, snapshot) {
  assert.equal(snapshot.visible, true, `[${check.name}] module contract block missing`);
  assert.equal(
    snapshot.rows.length,
    check.expectedRows.length,
    `[${check.name}] unexpected row count`
  );

  for (const expectedRow of check.expectedRows) {
    const actualRow = snapshot.rows.find(
      (row) => row.moduleId === expectedRow.moduleId
    );

    assert.ok(actualRow, `[${check.name}] missing row for ${expectedRow.moduleId}`);
    assert.equal(
      actualRow.title,
      expectedRow.title,
      `[${check.name}] unexpected title for ${expectedRow.moduleId}`
    );
    assert.equal(
      actualRow.relationship,
      expectedRow.relationship,
      `[${check.name}] unexpected relationship for ${expectedRow.moduleId}`
    );
    assert.equal(
      actualRow.tier,
      expectedRow.tier,
      `[${check.name}] unexpected tier for ${expectedRow.moduleId}`
    );
    assert.equal(
      actualRow.verification,
      expectedRow.verification,
      `[${check.name}] unexpected verification for ${expectedRow.moduleId}`
    );
    assert.equal(
      actualRow.guideHref,
      expectedRow.guideHref,
      `[${check.name}] unexpected guide href for ${expectedRow.moduleId}`
    );
  }
}

async function runNodeScript(scriptPath, args, env) {
  const child = spawn(process.execPath, ['--import', 'tsx', scriptPath, ...args], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  });

  const exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`${scriptPath} exited with code ${exitCode}`);
  }
}

async function signUpAsAdminCandidate(page, baseUrl, email) {
  await page.goto(`${baseUrl}/sign-up?callbackUrl=%2Fsettings%2Fprofile`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="auth-sign-up-form"]');
  await page.fill('input[name="name"]', DEFAULT_NAME);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEFAULT_PASSWORD);
  await page.click('[data-testid="auth-sign-up-submit"]');
  await page.waitForURL(/\/settings\/profile|\/$/, { timeout: 30_000 });
}

async function captureCheckSnapshot(page) {
  await page.waitForSelector('[data-testid="admin-settings-module-contract"]');
  const rows = await page.$$eval(
    '[data-testid="admin-settings-module-contract-row"]',
    (elements) =>
      elements.map((element) => {
        const queryText = (selector) =>
          element.querySelector(selector)?.textContent?.trim() || '';
        const queryHref = (selector) =>
          element.querySelector(selector)?.getAttribute('href') || '';

        return {
          moduleId: element.getAttribute('data-module-id') || '',
          title: queryText(
            '[data-testid="admin-settings-module-contract-title"] span:last-child'
          ),
          relationship: queryText(
            '[data-testid="admin-settings-module-contract-relationship"] [data-slot="badge"]'
          ),
          tier: queryText(
            '[data-testid="admin-settings-module-contract-tier"] [data-slot="badge"]'
          ),
          verification: queryText(
            '[data-testid="admin-settings-module-contract-verification"] [data-slot="badge"]'
          ),
          guideHref: queryHref(
            '[data-testid="admin-settings-module-contract-guide-link"]'
          ),
        };
      })
  );

  return {
    visible: true,
    rows,
  };
}

export async function main() {
  const lockedNodeInfo = await readLockedNodeInfo();
  const lockedNodeBaseUrl = lockedNodeInfo?.appUrl ?? null;
  const wranglerConfigPath =
    process.env.CF_PREVIEW_WRANGLER_CONFIG_PATH?.trim() ||
    path.resolve(rootDir, 'wrangler.cloudflare.toml');
  const databaseUrl =
    process.env.AUTH_SPIKE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    readWranglerLocalConnectionString(await readFile(wranglerConfigPath, 'utf8'));
  const preferredBaseUrl =
    process.env.ADMIN_SETTINGS_MODULE_CONTRACT_BASE_URL?.trim() ||
    lockedNodeBaseUrl ||
    DEFAULT_BASE_URL;
  const authSecret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    DEFAULT_AUTH_SECRET;
  const preferredPort = Number.parseInt(
    new URL(preferredBaseUrl).port || '3000',
    10
  );
  const reuseServer =
    process.env.ADMIN_SETTINGS_MODULE_CONTRACT_REUSE_SERVER !== 'false' &&
    ((lockedNodeInfo && isProcessAlive(lockedNodeInfo.pid)) ||
      (await detectReusableNodeServer({
        baseUrl: preferredBaseUrl,
        logger: { log: () => undefined },
      })));
  const baseUrl = reuseServer
    ? preferredBaseUrl
    : `http://127.0.0.1:${await findAvailablePort(preferredPort)}`;
  const nodeEnv = buildNodeAuthSpikeEnv(process.env, {
    databaseUrl,
    authSecret,
    appUrl: baseUrl,
  });
  const nodeManager = reuseServer
    ? null
    : createNodeDevManager({
        env: nodeEnv,
        port: Number.parseInt(new URL(baseUrl).port || '3000', 10),
      });

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = createTempEmail();

  try {
    await waitForNodeReady({ baseUrl });
    await runNodeScript('scripts/init-rbac.ts', [], nodeEnv);
    await signUpAsAdminCandidate(page, baseUrl, email);
    await runNodeScript(
      'scripts/assign-role.ts',
      [`--email=${email}`, '--role=super_admin'],
      nodeEnv
    );

    for (const check of getAdminSettingsModuleContractChecks(baseUrl)) {
      await page.goto(`${baseUrl}${check.path}`, {
        waitUntil: 'domcontentloaded',
      });
      const snapshot = await captureCheckSnapshot(page);
      validateAdminSettingsModuleContractSnapshot(check, snapshot);
    }
  } finally {
    await browser.close();
    await stopChild(nodeManager?.child);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
