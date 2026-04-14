import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import * as localeModule from '../src/config/locale/index.ts';
import * as authSpikeBrowserModule from '../tests/smoke/auth-spike.browser.ts';
import * as adminSettingsSmokeModule from './lib/admin-settings-smoke.ts';
import { validateCloudflareAppSmokeResponse } from './run-cf-app-smoke.mjs';
import {
  createPreviewManager,
  ensureCiDevVars,
  resolveAuthSecret,
  resolveConfiguredPreviewBaseUrl,
  resolvePreviewBaseUrl,
  runCloudflarePreviewSmoke,
  waitForPreviewReady,
} from './run-cf-preview-smoke.mjs';
import {
  buildNodeAuthSpikeEnv,
  readWranglerLocalConnectionString,
} from './run-local-auth-spike.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const DEFAULT_PASSWORD = 'CfAdminSettingsSmoke123!cf';
const DEFAULT_CALLBACK_PATH = '/settings/profile';
const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.CF_ADMIN_SETTINGS_SMOKE_REQUEST_TIMEOUT_MS || '30000',
  10
);
const { locales } = localeModule.default ?? localeModule;
const authSpikeBrowser = authSpikeBrowserModule.default ?? authSpikeBrowserModule;
const {
  assertSignedInSession,
  closeAuthBrowserHarness,
  createAuthBrowserHarness,
  getSessionViaAuthApi,
  signUpWithAuthBrowserHarness,
  stripOrigin,
} = authSpikeBrowser;
const adminSettingsSmoke =
  adminSettingsSmokeModule.default ?? adminSettingsSmokeModule;
const {
  NO_PERMISSION_PAGE_SELECTOR,
  buildAdminSettingsCallbackPath,
  buildLocalizedAdminNoPermissionPath,
  buildLocalizedSignInPath,
  captureAdminSettingsModuleContractSnapshot,
  getAdminSettingsModuleContractChecks,
  validateAdminSettingsModuleContractSnapshot,
  waitForAdminSettingsPageReady,
} = adminSettingsSmoke;
const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\..+/, '');
const artifactDir = path.resolve(
  rootDir,
  'output/playwright/cf-admin-settings-smoke',
  timestamp
);

function createTempEmail(label) {
  return `cf-admin-settings-smoke+${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function captureFailureScreenshot(page, label) {
  try {
    await mkdir(artifactDir, { recursive: true });
    const safeLabel = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const screenshotPath = path.resolve(artifactDir, `${safeLabel}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch {
    return null;
  }
}

async function runPhase(label, action) {
  try {
    return await action();
  } catch (error) {
    throw new Error(
      `[${label}] ${error instanceof Error ? error.message : String(error)}`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function assertSameOrigin(urlString, baseUrl, label) {
  assert.equal(
    new URL(urlString).origin,
    new URL(baseUrl).origin,
    `[${label}] unexpected origin`
  );
}

async function signUpSmokeUser({
  harness,
  baseUrl,
  email,
  userName,
  label,
}) {
  await signUpWithAuthBrowserHarness({
    harness,
    baseUrl,
    email,
    password: DEFAULT_PASSWORD,
    callbackPath: DEFAULT_CALLBACK_PATH,
    userName,
  });

  const session = await getSessionViaAuthApi(harness.context, baseUrl);
  assertSignedInSession(session, `${label} 应保持登录状态`);
}

async function runUnauthenticatedChecks({ baseUrl }) {
  const baseUrlOrigin = new URL(baseUrl).origin;

  for (const locale of locales) {
    for (const check of getAdminSettingsModuleContractChecks({ locale })) {
      const callbackPath = buildAdminSettingsCallbackPath(check.name);
      const response = await fetch(`${baseUrl}${check.path}`, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const bodyText = await response.text();

      await validateCloudflareAppSmokeResponse(
        {
          name: `unauthenticated:${locale}:${check.name}`,
          expectedStatus: 307,
          expectedLocationOrigin: baseUrlOrigin,
          expectedLocationPath: buildLocalizedSignInPath(locale),
          expectedLocationSearchParams: {
            callbackUrl: callbackPath,
          },
        },
        response,
        bodyText
      );
      console.log(`✓ [unauthenticated] ${locale} ${check.path}`);
    }
  }
}

async function waitForPath(page, baseUrl, expectedPath, label) {
  await page.waitForURL(
    (url) => stripOrigin(url.toString()).startsWith(expectedPath),
    {
      timeout: 20_000,
      waitUntil: 'commit',
    }
  );

  const currentUrl = page.url();
  assertSameOrigin(currentUrl, baseUrl, label);
  assert.ok(
    stripOrigin(currentUrl).startsWith(expectedPath),
    `[${label}] unexpected final path: ${stripOrigin(currentUrl)}`
  );
}

async function runNonAdminChecks({ harness, baseUrl }) {
  for (const locale of locales) {
    for (const check of getAdminSettingsModuleContractChecks({ locale })) {
      const label = `non-admin:${locale}:${check.name}`;

      try {
        const response = await harness.page.goto(`${baseUrl}${check.path}`, {
          waitUntil: 'domcontentloaded',
        });
        if (response && response.status() >= 500) {
          throw new Error(`unexpected response status ${response.status()}`);
        }

        await waitForPath(
          harness.page,
          baseUrl,
          buildLocalizedAdminNoPermissionPath(locale),
          label
        );
        await harness.page.waitForSelector(NO_PERMISSION_PAGE_SELECTOR, {
          state: 'visible',
          timeout: 20_000,
        });
        console.log(`✓ [non-admin] ${locale} ${check.path}`);
      } catch (error) {
        const screenshotPath = await captureFailureScreenshot(harness.page, label);
        const suffix = screenshotPath ? ` (screenshot: ${screenshotPath})` : '';
        throw new Error(
          `[${label}] ${
            error instanceof Error ? error.message : String(error)
          }${suffix}`
        );
      }
    }
  }
}

async function runSuperAdminChecks({ harness, baseUrl }) {
  for (const locale of locales) {
    for (const check of getAdminSettingsModuleContractChecks({ locale })) {
      const label = `super-admin:${locale}:${check.name}`;

      try {
        const response = await harness.page.goto(`${baseUrl}${check.path}`, {
          waitUntil: 'domcontentloaded',
        });
        if (response && response.status() >= 500) {
          throw new Error(`unexpected response status ${response.status()}`);
        }

        await waitForPath(harness.page, baseUrl, check.path, label);
        assertSameOrigin(harness.page.url(), baseUrl, label);
        await waitForAdminSettingsPageReady(harness.page);
        const snapshot = await captureAdminSettingsModuleContractSnapshot(
          harness.page
        );
        validateAdminSettingsModuleContractSnapshot(check, snapshot);
        console.log(`✓ [super-admin] ${locale} ${check.path}`);
      } catch (error) {
        const screenshotPath = await captureFailureScreenshot(harness.page, label);
        const suffix = screenshotPath ? ` (screenshot: ${screenshotPath})` : '';
        throw new Error(
          `[${label}] ${
            error instanceof Error ? error.message : String(error)
          }${suffix}`
        );
      }
    }
  }
}

export async function main() {
  const fallbackBaseUrl = resolveConfiguredPreviewBaseUrl(
    process.env.CF_ADMIN_SETTINGS_SMOKE_URL,
    process.env.CF_PREVIEW_URL,
    process.env.CF_PREVIEW_APP_URL
  );
  const wranglerConfigPath =
    process.env.CF_PREVIEW_WRANGLER_CONFIG_PATH?.trim() ||
    path.resolve(rootDir, 'wrangler.cloudflare.toml');
  const databaseUrl =
    process.env.AUTH_SPIKE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    readWranglerLocalConnectionString(await readFile(wranglerConfigPath, 'utf8'));
  const reuseServer = process.env.CF_PREVIEW_REUSE_SERVER === 'true';
  const authSecret = resolveAuthSecret();

  const devVars = reuseServer
    ? null
    : await ensureCiDevVars({
        authSecret,
        extraVars: {
          DEPLOY_TARGET: 'cloudflare',
        },
      });
  const preview = reuseServer
    ? null
    : createPreviewManager({ wranglerConfigPath });

  const baseUrl = preview
    ? await resolvePreviewBaseUrl({
        preview,
        fallbackBaseUrl,
      })
    : fallbackBaseUrl;
  const nodeEnv = buildNodeAuthSpikeEnv(process.env, {
    databaseUrl,
    authSecret,
    appUrl: baseUrl,
  });

  try {
    await runPhase('preview-ready', async () => {
      if (preview) {
        await waitForPreviewReady({ baseUrl });
      }
    });
    await runPhase('preview-sanity', async () => {
      await runCloudflarePreviewSmoke({ baseUrl });
    });
    await runPhase('rbac-bootstrap', async () => {
      await runNodeScript('scripts/init-rbac.ts', [], nodeEnv);
    });
    await runPhase('unauthenticated-redirects', async () => {
      await runUnauthenticatedChecks({ baseUrl });
    });

    const nonAdminHarness = await createAuthBrowserHarness();
    try {
      await runPhase('non-admin-bootstrap', async () => {
        await signUpSmokeUser({
          harness: nonAdminHarness,
          baseUrl,
          email: createTempEmail('member'),
          userName: 'CF Admin Settings Member',
          label: '普通用户',
        });
      });
      await runPhase('non-admin-denial', async () => {
        await runNonAdminChecks({ harness: nonAdminHarness, baseUrl });
      });
    } finally {
      await closeAuthBrowserHarness(nonAdminHarness);
    }

    const superAdminHarness = await createAuthBrowserHarness();
    const superAdminEmail = createTempEmail('super-admin');
    try {
      await runPhase('super-admin-bootstrap', async () => {
        await signUpSmokeUser({
          harness: superAdminHarness,
          baseUrl,
          email: superAdminEmail,
          userName: 'CF Admin Settings Super Admin',
          label: 'super_admin 用户',
        });
        await runNodeScript(
          'scripts/assign-role.ts',
          [`--email=${superAdminEmail}`, '--role=super_admin'],
          nodeEnv
        );
      });
      await runPhase('super-admin-render-and-contract', async () => {
        await runSuperAdminChecks({ harness: superAdminHarness, baseUrl });
      });
    } finally {
      await closeAuthBrowserHarness(superAdminHarness);
    }

    console.log('Cloudflare admin settings smoke passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cloudflare admin settings smoke failed: ${message}`);

    if (preview?.recentLogs?.length) {
      console.error('--- recent preview logs ---');
      console.error(preview.recentLogs.join(''));
      console.error('--- end preview logs ---');
    }

    process.exitCode = 1;
  } finally {
    await preview?.stop();
    await devVars?.cleanup();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
