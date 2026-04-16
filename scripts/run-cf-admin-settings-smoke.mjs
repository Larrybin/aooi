import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import * as localeModule from '../src/config/locale/index.ts';
import * as authSpikeBrowserModule from '../tests/smoke/auth-spike.browser.ts';
import * as adminSettingsSmokeModule from './lib/admin-settings-smoke.ts';
import {
  renderCloudflareLocalTopologyLogs,
  resolveCloudflareLocalDatabaseUrl,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import { validateCloudflareAppSmokeResponse } from './run-cf-app-smoke.mjs';
import {
  resolveAuthSecret,
  resolveConfiguredPreviewBaseUrl,
  runCloudflarePreviewSmoke,
  waitForPreviewReady,
} from './run-cf-preview-smoke.mjs';
import { buildNodeAuthSpikeEnv } from './run-local-auth-spike.mjs';

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
const DEFAULT_STORAGE_UPLOAD_FILE = {
  fileName: 'cf-admin-settings-phase2.png',
  mimeType: 'image/png',
  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00],
};
const SOCIAL_PROVIDER_CONFIGS = {
  google: {
    authorizeUrlPrefix: 'https://accounts.google.com/o/oauth2/auth',
    buttonTestId: 'auth-social-google',
  },
  github: {
    authorizeUrlPrefix: 'https://github.com/login/oauth/authorize',
    buttonTestId: 'auth-social-github',
  },
};

const localeConfig = localeModule.default ?? localeModule;
const { defaultLocale, locales } = localeConfig;
const authSpikeBrowser = authSpikeBrowserModule.default ?? authSpikeBrowserModule;
const {
  assertSignedInSession,
  assertSignedOutSession,
  bridgeClearedSessionCookieIfNeeded,
  bridgeSessionCookieIfNeeded,
  closeAuthBrowserHarness,
  createAuthBrowserHarness,
  ensureProtectedPageNavigation,
  getSessionViaAuthApi,
  hasAuthErrorQuery,
  isTerminalAuthErrorUrl,
  signOutViaAuthApi,
  signUpWithAuthBrowserHarness,
  stripOrigin,
  waitForTerminalAuthErrorPage,
} = authSpikeBrowser;
const adminSettingsSmoke =
  adminSettingsSmokeModule.default ?? adminSettingsSmokeModule;
const {
  FORM_SUBMIT_BUTTON_SELECTOR,
  NO_PERMISSION_PAGE_SELECTOR,
  buildAdminSettingsCallbackPath,
  buildAdminSettingsPath,
  buildFormControlSelector,
  buildFormFieldSelector,
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

export function resolveSmokeLocales(
  allLocales = locales,
  rawValue = process.env.CF_ADMIN_SETTINGS_SMOKE_LOCALES
) {
  const requestedLocales = rawValue
    ?.split(',')
    .map((locale) => locale.trim())
    .filter(Boolean);

  if (!requestedLocales?.length) {
    return allLocales;
  }

  const unknownLocales = requestedLocales.filter(
    (locale) => !allLocales.includes(locale)
  );
  if (unknownLocales.length > 0) {
    throw new Error(
      `Unknown CF_ADMIN_SETTINGS_SMOKE_LOCALES entries: ${unknownLocales.join(', ')}`
    );
  }

  return requestedLocales;
}

const smokeLocales = resolveSmokeLocales();

function createTempEmail(label) {
  return `cf-admin-settings-smoke+${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function createGeneralWriteValues() {
  return {
    app_name: `CF Admin Settings ${timestamp}`,
    app_url: `https://phase2-${timestamp}.example.com/path?ignored=1`,
    general_support_email: `Support.${timestamp}@EXAMPLE.COM`,
  };
}

function createAuthWriteValues() {
  return {
    google_auth_enabled: true,
    google_client_id: 'oauth-spike-google-client-id',
    google_client_secret: 'oauth-spike-google-client-secret',
    github_auth_enabled: true,
    github_client_id: 'oauth-spike-github-client-id',
    github_client_secret: 'oauth-spike-github-client-secret',
  };
}

function createStorageWriteValues() {
  return {
    r2_access_key: 'storage-spike-access-key',
    r2_secret_key: 'storage-spike-secret-key',
    r2_bucket_name: 'storage-spike-bucket',
    r2_endpoint: 'https://account-id.r2.cloudflarestorage.com',
    r2_domain: 'https://storage-spike.example.com',
  };
}

function normalizeGeneralExpectedValues(values) {
  return {
    app_name: values.app_name,
    app_url: new URL(values.app_url).origin,
    general_support_email: values.general_support_email.trim().toLowerCase(),
  };
}

function createProviderPath(provider) {
  return `/api/auth/callback/${provider}`;
}

export function buildMockProviderCallbackUrl({
  authRequestUrl,
  mode,
  provider,
}) {
  const state = authRequestUrl.searchParams.get('state');
  const redirectUri = authRequestUrl.searchParams.get('redirect_uri');

  assert(state, `[${provider}] missing state`);
  assert(redirectUri, `[${provider}] missing redirect_uri`);

  const callbackUrl = new URL(redirectUri);
  if (mode === 'success') {
    callbackUrl.searchParams.set('code', `oauth-spike-${provider}-success`);
    callbackUrl.searchParams.set('state', state);
    return callbackUrl.toString();
  }

  callbackUrl.searchParams.set('error', 'access_denied');
  callbackUrl.searchParams.set(
    'error_description',
    'cf_admin_settings_phase2_denied'
  );
  callbackUrl.searchParams.set('state', state);
  return callbackUrl.toString();
}

function safeParseJson(bodyText) {
  try {
    return JSON.parse(bodyText);
  } catch {
    return null;
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

export async function runPhaseSequence({ phases, cleanup }) {
  let phaseError = null;
  let cleanupError = null;

  for (const phase of phases) {
    try {
      await runPhase(phase.label, phase.action);
    } catch (error) {
      phaseError = error instanceof Error ? error : new Error(String(error));
      break;
    }
  }

  if (cleanup) {
    try {
      await cleanup();
    } catch (error) {
      cleanupError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (phaseError && cleanupError) {
    throw new Error(
      `${phaseError.message}; [cleanup] ${cleanupError.message}`,
      { cause: phaseError }
    );
  }

  if (phaseError) {
    throw phaseError;
  }

  if (cleanupError) {
    throw cleanupError;
  }
}

function assertSameOrigin(urlString, baseUrl, label) {
  assert.equal(
    new URL(urlString).origin,
    new URL(baseUrl).origin,
    `[${label}] unexpected origin`
  );
}

async function withFailureScreenshot(page, label, action) {
  try {
    return await action();
  } catch (error) {
    const screenshotPath = await captureFailureScreenshot(page, label);
    const suffix = screenshotPath ? ` (screenshot: ${screenshotPath})` : '';
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}${suffix}`
    );
  }
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

  for (const locale of smokeLocales) {
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
  for (const locale of smokeLocales) {
    for (const check of getAdminSettingsModuleContractChecks({ locale })) {
      const label = `non-admin:${locale}:${check.name}`;

      await withFailureScreenshot(harness.page, label, async () => {
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
      });
    }
  }
}

async function runSuperAdminChecks({ harness, baseUrl }) {
  for (const locale of smokeLocales) {
    for (const check of getAdminSettingsModuleContractChecks({ locale })) {
      const label = `super-admin:${locale}:${check.name}`;

      await withFailureScreenshot(harness.page, label, async () => {
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
      });
    }
  }
}

async function openSettingsTab(page, baseUrl, tab, locale = defaultLocale) {
  const pathName = buildAdminSettingsPath(tab, locale);
  const response = await page.goto(`${baseUrl}${pathName}`, {
    waitUntil: 'domcontentloaded',
  });

  if (response && response.status() >= 500) {
    throw new Error(`[${tab}] unexpected response status ${response.status()}`);
  }

  await waitForPath(page, baseUrl, pathName, `${tab}:${locale}`);
  await waitForAdminSettingsPageReady(page);
}

function getFieldControl(page, fieldName) {
  return page.locator(buildFormControlSelector(fieldName));
}

async function describeRenderedFormTestIds(page) {
  return await page.evaluate(() => {
    const testIds = Array.from(document.querySelectorAll('[data-testid]'))
      .map((element) => element.getAttribute('data-testid') || '')
      .filter(
        (value) =>
          value.startsWith('form-field-') || value.startsWith('form-control-')
      );

    return Array.from(new Set(testIds)).sort();
  });
}

async function readTextField(page, fieldName) {
  const locator = getFieldControl(page, fieldName);

  try {
    await locator.waitFor({ state: 'attached', timeout: 20_000 });
    return await locator.inputValue();
  } catch (error) {
    const renderedTestIds = await describeRenderedFormTestIds(page).catch(
      () => []
    );
    throw new Error(
      `[${fieldName}] control not available. rendered test ids: ${
        renderedTestIds.length > 0 ? renderedTestIds.join(', ') : '(none)'
      }`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

async function fillTextField(page, fieldName, value) {
  const locator = getFieldControl(page, fieldName);
  await locator.fill('');
  await locator.fill(value);
}

async function readSwitchField(page, fieldName) {
  const locator = getFieldControl(page, fieldName);

  try {
    await locator.waitFor({ state: 'attached', timeout: 20_000 });
    return (await locator.getAttribute('aria-checked')) === 'true';
  } catch (error) {
    const renderedTestIds = await describeRenderedFormTestIds(page).catch(
      () => []
    );
    throw new Error(
      `[${fieldName}] control not available. rendered test ids: ${
        renderedTestIds.length > 0 ? renderedTestIds.join(', ') : '(none)'
      }`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

async function setSwitchField(page, fieldName, expected) {
  const locator = getFieldControl(page, fieldName);
  const current = await readSwitchField(page, fieldName);
  if (current !== expected) {
    await locator.click();
  }
  assert.equal(
    await readSwitchField(page, fieldName),
    expected,
    `[${fieldName}] switch state mismatch after update`
  );
}

async function submitFormForField(page, fieldName) {
  const form = page
    .locator(buildFormFieldSelector(fieldName))
    .locator('xpath=ancestor::form[1]');
  await form.locator(FORM_SUBMIT_BUTTON_SELECTOR).click();
}

async function waitForToastMessage(page, expectedText) {
  await page.waitForFunction(
    (text) =>
      Array.from(document.querySelectorAll('[data-sonner-toast]')).some(
        (node) => (node.textContent || '').includes(text)
      ),
    expectedText,
    {
      timeout: 20_000,
    }
  );
}

async function withFreshPage(context, action) {
  const page = await context.newPage();
  try {
    return await action(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function captureSettingsBaseline({ page, baseUrl }) {
  await withFailureScreenshot(page, 'baseline-capture', async () => {
    await openSettingsTab(page, baseUrl, 'general');
  });

  const general = {
    app_name: await readTextField(page, 'app_name'),
    app_url: await readTextField(page, 'app_url'),
    general_support_email: await readTextField(page, 'general_support_email'),
  };

  await withFailureScreenshot(page, 'baseline-capture-auth', async () => {
    await openSettingsTab(page, baseUrl, 'auth');
  });

  const auth = {
    google_auth_enabled: await readSwitchField(page, 'google_auth_enabled'),
    google_client_id: await readTextField(page, 'google_client_id'),
    google_client_secret: await readTextField(page, 'google_client_secret'),
    github_auth_enabled: await readSwitchField(page, 'github_auth_enabled'),
    github_client_id: await readTextField(page, 'github_client_id'),
    github_client_secret: await readTextField(page, 'github_client_secret'),
  };

  await withFailureScreenshot(page, 'baseline-capture-storage', async () => {
    await openSettingsTab(page, baseUrl, 'storage');
  });

  const storage = {
    r2_access_key: await readTextField(page, 'r2_access_key'),
    r2_secret_key: await readTextField(page, 'r2_secret_key'),
    r2_bucket_name: await readTextField(page, 'r2_bucket_name'),
    r2_endpoint: await readTextField(page, 'r2_endpoint'),
    r2_domain: await readTextField(page, 'r2_domain'),
  };

  return { auth, general, storage };
}

async function restoreGeneralSettings({ page, baseUrl, baseline }) {
  await openSettingsTab(page, baseUrl, 'general');
  await fillTextField(page, 'app_name', baseline.app_name);
  await fillTextField(page, 'app_url', baseline.app_url);
  await fillTextField(
    page,
    'general_support_email',
    baseline.general_support_email
  );
  await submitFormForField(page, 'app_name');
  await waitForToastMessage(page, 'Settings updated');
}

async function restoreAuthSettings({ page, baseUrl, baseline }) {
  await openSettingsTab(page, baseUrl, 'auth');
  await setSwitchField(
    page,
    'google_auth_enabled',
    baseline.google_auth_enabled
  );
  await fillTextField(page, 'google_client_id', baseline.google_client_id);
  await fillTextField(
    page,
    'google_client_secret',
    baseline.google_client_secret
  );
  await submitFormForField(page, 'google_client_id');
  await waitForToastMessage(page, 'Settings updated');

  await openSettingsTab(page, baseUrl, 'auth');
  await setSwitchField(
    page,
    'github_auth_enabled',
    baseline.github_auth_enabled
  );
  await fillTextField(page, 'github_client_id', baseline.github_client_id);
  await fillTextField(
    page,
    'github_client_secret',
    baseline.github_client_secret
  );
  await submitFormForField(page, 'github_client_id');
  await waitForToastMessage(page, 'Settings updated');
}

async function restoreStorageSettings({ page, baseUrl, baseline }) {
  await openSettingsTab(page, baseUrl, 'storage');
  await fillTextField(page, 'r2_access_key', baseline.r2_access_key);
  await fillTextField(page, 'r2_secret_key', baseline.r2_secret_key);
  await fillTextField(page, 'r2_bucket_name', baseline.r2_bucket_name);
  await fillTextField(page, 'r2_endpoint', baseline.r2_endpoint);
  await fillTextField(page, 'r2_domain', baseline.r2_domain);
  await submitFormForField(page, 'r2_access_key');
  await waitForToastMessage(page, 'Settings updated');
}

async function assertGeneralReadback({
  baseUrl,
  context,
  expectedValues,
  label,
}) {
  await withFreshPage(context, async (page) => {
    await withFailureScreenshot(page, label, async () => {
      await openSettingsTab(page, baseUrl, 'general');
      assert.equal(await readTextField(page, 'app_name'), expectedValues.app_name);
      assert.equal(await readTextField(page, 'app_url'), expectedValues.app_url);
      assert.equal(
        await readTextField(page, 'general_support_email'),
        expectedValues.general_support_email
      );
    });
  });
}

async function runGeneralWriteSuccess({
  harness,
  baseUrl,
  expectedValues,
  writeValues,
}) {
  await withFailureScreenshot(
    harness.page,
    'general-write-success',
    async () => {
      await openSettingsTab(harness.page, baseUrl, 'general');
      await fillTextField(harness.page, 'app_name', writeValues.app_name);
      await fillTextField(harness.page, 'app_url', writeValues.app_url);
      await fillTextField(
        harness.page,
        'general_support_email',
        writeValues.general_support_email
      );
      await submitFormForField(harness.page, 'app_name');
      await waitForToastMessage(harness.page, 'Settings updated');
    }
  );

  await assertGeneralReadback({
    baseUrl,
    context: harness.context,
    expectedValues,
    label: 'general-write-success-readback',
  });
}

async function runGeneralWriteFailure({ harness, baseUrl, expectedValues }) {
  await withFailureScreenshot(
    harness.page,
    'general-write-failure',
    async () => {
      await openSettingsTab(harness.page, baseUrl, 'general');
      await fillTextField(harness.page, 'app_url', 'not-a-valid-url');
      await submitFormForField(harness.page, 'app_name');
      await waitForToastMessage(harness.page, 'Invalid App URL.');
    }
  );

  await assertGeneralReadback({
    baseUrl,
    context: harness.context,
    expectedValues,
    label: 'general-write-failure-readback',
  });
}

async function saveAuthConfig({ page, baseUrl, values }) {
  await withFailureScreenshot(page, 'auth-config-save-google', async () => {
    await openSettingsTab(page, baseUrl, 'auth');
    await setSwitchField(page, 'google_auth_enabled', values.google_auth_enabled);
    await fillTextField(page, 'google_client_id', values.google_client_id);
    await fillTextField(
      page,
      'google_client_secret',
      values.google_client_secret
    );
    await submitFormForField(page, 'google_client_id');
    await waitForToastMessage(page, 'Settings updated');
  });

  await withFailureScreenshot(page, 'auth-config-save-github', async () => {
    await openSettingsTab(page, baseUrl, 'auth');
    await setSwitchField(page, 'github_auth_enabled', values.github_auth_enabled);
    await fillTextField(page, 'github_client_id', values.github_client_id);
    await fillTextField(
      page,
      'github_client_secret',
      values.github_client_secret
    );
    await submitFormForField(page, 'github_client_id');
    await waitForToastMessage(page, 'Settings updated');
  });
}

async function saveStorageConfig({ page, baseUrl, values }) {
  await withFailureScreenshot(page, 'storage-config-save', async () => {
    await openSettingsTab(page, baseUrl, 'storage');
    await fillTextField(page, 'r2_access_key', values.r2_access_key);
    await fillTextField(page, 'r2_secret_key', values.r2_secret_key);
    await fillTextField(page, 'r2_bucket_name', values.r2_bucket_name);
    await fillTextField(page, 'r2_endpoint', values.r2_endpoint);
    await fillTextField(page, 'r2_domain', values.r2_domain);
    await submitFormForField(page, 'r2_access_key');
    await waitForToastMessage(page, 'Settings updated');
  });
}

async function runOAuthCase({ baseUrl, mode, provider }) {
  const providerConfig = SOCIAL_PROVIDER_CONFIGS[provider];
  const harness = await createAuthBrowserHarness();

  try {
    await withFailureScreenshot(
      harness.page,
      `auth-${provider}-${mode}`,
      async () => {
        let callbackResponse = null;
        const signInResponsePromise = harness.page.waitForResponse(
          (response) => response.url().includes('/api/auth/sign-in/social'),
          { timeout: 20_000 }
        );
        const callbackResponsePromise = harness.page.waitForResponse(
          (response) => response.url().includes(createProviderPath(provider)),
          { timeout: 20_000 }
        );
        const routeHandler = async (route) => {
          const callbackUrl = buildMockProviderCallbackUrl({
            authRequestUrl: new URL(route.request().url()),
            mode,
            provider,
          });
          await route.fulfill({
            status: 302,
            headers: {
              location: callbackUrl,
            },
          });
        };

        await harness.page.route(
          `${providerConfig.authorizeUrlPrefix}*`,
          routeHandler
        );

        try {
          await harness.page.goto(
            `${baseUrl}/sign-in?callbackUrl=${encodeURIComponent(DEFAULT_CALLBACK_PATH)}`,
            { waitUntil: 'domcontentloaded' }
          );
          await harness.page
            .locator(`[data-testid="${providerConfig.buttonTestId}"]`)
            .waitFor({
              state: 'visible',
              timeout: 20_000,
            });
          await harness.page
            .locator(`[data-testid="${providerConfig.buttonTestId}"]`)
            .click({
              noWaitAfter: true,
            });

          const signInResponse = await signInResponsePromise;
          if (!signInResponse.ok()) {
            throw new Error(
              `[${provider}] sign-in/social failed with ${signInResponse.status()}`
            );
          }

          await bridgeSessionCookieIfNeeded({
            page: harness.page,
            context: harness.context,
            cdpSession: harness.cdpSession,
            baseUrl,
            response: signInResponse,
          });

          callbackResponse = await callbackResponsePromise;

          if (mode === 'success') {
            await bridgeSessionCookieIfNeeded({
              page: harness.page,
              context: harness.context,
              cdpSession: harness.cdpSession,
              baseUrl,
              response: callbackResponse,
            });
          }
        } finally {
          await harness.page.unroute(
            `${providerConfig.authorizeUrlPrefix}*`,
            routeHandler
          );
        }

        if (mode === 'success') {
          await ensureProtectedPageNavigation(
            harness.page,
            baseUrl,
            DEFAULT_CALLBACK_PATH
          );
          const session = await getSessionViaAuthApi(harness.context, baseUrl);
          assertSignedInSession(
            session,
            `[${provider}] success should establish session`
          );

          const signOutResponse = await signOutViaAuthApi(
            harness.context,
            baseUrl
          );
          await bridgeClearedSessionCookieIfNeeded({
            context: harness.context,
            cdpSession: harness.cdpSession,
            baseUrl,
            responses: [signOutResponse],
          });
          const signedOutSession = await getSessionViaAuthApi(
            harness.context,
            baseUrl
          );
          assertSignedOutSession(
            signedOutSession,
            `[${provider}] success case must sign out cleanly`
          );
          return;
        }

        await waitForTerminalAuthErrorPage(harness.page);
        assert(callbackResponse, `[${provider}] denied flow should hit callback`);
        const callbackLocation = await callbackResponse.headerValue('location');
        assert.equal(
          callbackResponse.status(),
          302,
          `[${provider}] denied callback should redirect to explicit failure path`
        );
        assert(
          callbackLocation,
          `[${provider}] denied callback should include redirect location`
        );
        assert.equal(
          hasAuthErrorQuery(
            new URL(callbackLocation, callbackResponse.url()).toString()
          ),
          true,
          `[${provider}] denied callback location should expose explicit error semantics`
        );
        assert.equal(
          new URL(callbackLocation, callbackResponse.url()).searchParams.get('error'),
          'access_denied',
          `[${provider}] denied callback location should preserve access_denied error`
        );
        assert.equal(
          new URL(harness.page.url()).searchParams.get('error'),
          'access_denied',
          `[${provider}] denied final page should preserve access_denied error`
        );
        assert.equal(
          isTerminalAuthErrorUrl(harness.page.url()),
          true,
          `[${provider}] denied final page must stay on sign-in error semantics`
        );
        const session = await getSessionViaAuthApi(harness.context, baseUrl);
        assertSignedOutSession(
          session,
          `[${provider}] denied should not establish session`
        );
      }
    );
  } finally {
    await closeAuthBrowserHarness(harness);
  }
}

async function uploadStorageFileViaPage({ baseUrl, page }) {
  return await page.evaluate(
    async ({ baseUrl, file }) => {
      const formData = new FormData();
      formData.append(
        'files',
        new File([new Uint8Array(file.bytes)], file.fileName, {
          type: file.mimeType,
        })
      );

      const response = await fetch(`${baseUrl}/api/storage/upload-image`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      return {
        bodyText: await response.text(),
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
      };
    },
    {
      baseUrl,
      file: DEFAULT_STORAGE_UPLOAD_FILE,
    }
  );
}

async function assertStorageUploadHappy({ baseUrl, page }) {
  await withFailureScreenshot(page, 'storage-upload-happy', async () => {
    const response = await uploadStorageFileViaPage({ baseUrl, page });
    const body = safeParseJson(response.bodyText);

    assert.equal(response.status, 200);
    assert.equal(body?.code, 0);
    assert.equal(body?.data?.results?.[0]?.provider, 'r2');

    const key = body?.data?.results?.[0]?.key;
    const url = body?.data?.urls?.[0];

    assert.equal(typeof key, 'string');
    assert.equal(typeof url, 'string');
    assert.match(key, /^uploads\/.+\.png$/);
    assert.equal(url, `https://storage-spike.example.com/r2/${key}`);
  });
}

async function assertStorageUploadDenied({ baseUrl, page }) {
  await withFailureScreenshot(page, 'storage-upload-denied', async () => {
    const response = await uploadStorageFileViaPage({ baseUrl, page });
    const body = safeParseJson(response.bodyText);

    assert.equal(response.status, 503);
    assert.equal(body?.message, 'storage service unavailable');
  });
}

export async function main() {
  const fallbackBaseUrl = resolveConfiguredPreviewBaseUrl(
    process.env.CF_ADMIN_SETTINGS_SMOKE_URL,
    process.env.CF_LOCAL_SMOKE_URL
  );
  const wranglerConfigPath =
    process.env.CF_LOCAL_SMOKE_WRANGLER_CONFIG_PATH?.trim() ||
    path.resolve(rootDir, 'wrangler.cloudflare.toml');
  const databaseUrl = await resolveCloudflareLocalDatabaseUrl({
    processEnv: process.env,
    wranglerConfigPath,
  });
  const reuseServer = process.env.CF_LOCAL_SMOKE_REUSE_SERVER === 'true';
  const authSecret = resolveAuthSecret();
  const topology = reuseServer
    ? null
    : await startCloudflareLocalDevTopology({
        databaseUrl,
        routerTemplatePath: wranglerConfigPath,
        routerBaseUrl: fallbackBaseUrl,
        authSecret,
        extraVars: {
          AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true',
          STORAGE_SPIKE_UPLOAD_MOCK: 'true',
        },
        processEnv: {
          ...process.env,
          AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true',
          STORAGE_SPIKE_UPLOAD_MOCK: 'true',
        },
      });
  const baseUrl = topology ? topology.getRouterBaseUrl() : fallbackBaseUrl;
  const nodeEnv = {
    ...buildNodeAuthSpikeEnv(process.env, {
      databaseUrl,
      authSecret,
      appUrl: baseUrl,
    }),
    AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true',
    STORAGE_SPIKE_UPLOAD_MOCK: 'true',
  };

  let writerHarness = null;
  let baseline = null;
  let expectedGeneralValues = null;

  try {
    await runPhaseSequence({
      phases: [
        {
          label: 'preview-ready',
          action: async () => {
            if (topology) {
              await waitForPreviewReady({ baseUrl });
            }
          },
        },
        {
          label: 'preview-sanity',
          action: async () => {
            await runCloudflarePreviewSmoke({ baseUrl });
          },
        },
        {
          label: 'rbac-bootstrap',
          action: async () => {
            await runNodeScript('scripts/init-rbac.ts', [], nodeEnv);
          },
        },
        {
          label: 'unauthenticated-redirects',
          action: async () => {
            await runUnauthenticatedChecks({ baseUrl });
          },
        },
        {
          label: 'non-admin-denial',
          action: async () => {
            const nonAdminHarness = await createAuthBrowserHarness();
            try {
              await signUpSmokeUser({
                harness: nonAdminHarness,
                baseUrl,
                email: createTempEmail('member'),
                userName: 'CF Admin Settings Member',
                label: '普通用户',
              });
              await runNonAdminChecks({ harness: nonAdminHarness, baseUrl });
            } finally {
              await closeAuthBrowserHarness(nonAdminHarness);
            }
          },
        },
        {
          label: 'super-admin-render-and-contract',
          action: async () => {
            writerHarness = await createAuthBrowserHarness();
            const superAdminEmail = createTempEmail('super-admin');
            await signUpSmokeUser({
              harness: writerHarness,
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
            await runSuperAdminChecks({ harness: writerHarness, baseUrl });
          },
        },
        {
          label: 'baseline-capture',
          action: async () => {
            baseline = await captureSettingsBaseline({
              page: writerHarness.page,
              baseUrl,
            });
          },
        },
        {
          label: 'general-write-success',
          action: async () => {
            const writeValues = createGeneralWriteValues();
            expectedGeneralValues = normalizeGeneralExpectedValues(writeValues);
            await runGeneralWriteSuccess({
              harness: writerHarness,
              baseUrl,
              expectedValues: expectedGeneralValues,
              writeValues,
            });
          },
        },
        {
          label: 'general-write-failure',
          action: async () => {
            await runGeneralWriteFailure({
              harness: writerHarness,
              baseUrl,
              expectedValues: expectedGeneralValues,
            });
          },
        },
        {
          label: 'general-readback',
          action: async () => {
            await assertGeneralReadback({
              baseUrl,
              context: writerHarness.context,
              expectedValues: expectedGeneralValues,
              label: 'general-readback',
            });
          },
        },
        {
          label: 'auth-config-save',
          action: async () => {
            await saveAuthConfig({
              page: writerHarness.page,
              baseUrl,
              values: createAuthWriteValues(),
            });
          },
        },
        {
          label: 'auth-google-happy',
          action: async () => {
            await runOAuthCase({
              baseUrl,
              provider: 'google',
              mode: 'success',
            });
          },
        },
        {
          label: 'auth-google-denied',
          action: async () => {
            await runOAuthCase({
              baseUrl,
              provider: 'google',
              mode: 'denied',
            });
          },
        },
        {
          label: 'auth-github-happy',
          action: async () => {
            await runOAuthCase({
              baseUrl,
              provider: 'github',
              mode: 'success',
            });
          },
        },
        {
          label: 'auth-github-denied',
          action: async () => {
            await runOAuthCase({
              baseUrl,
              provider: 'github',
              mode: 'denied',
            });
          },
        },
        {
          label: 'storage-config-save',
          action: async () => {
            await saveStorageConfig({
              page: writerHarness.page,
              baseUrl,
              values: createStorageWriteValues(),
            });
          },
        },
        {
          label: 'storage-upload-happy',
          action: async () => {
            await assertStorageUploadHappy({
              baseUrl,
              page: writerHarness.page,
            });
          },
        },
        {
          label: 'storage-upload-denied',
          action: async () => {
            await withFailureScreenshot(
              writerHarness.page,
              'storage-upload-denied-config',
              async () => {
                await openSettingsTab(writerHarness.page, baseUrl, 'storage');
                await fillTextField(writerHarness.page, 'r2_bucket_name', '');
                await submitFormForField(writerHarness.page, 'r2_access_key');
                await waitForToastMessage(writerHarness.page, 'Settings updated');
              }
            );
            await assertStorageUploadDenied({
              baseUrl,
              page: writerHarness.page,
            });
          },
        },
      ],
      cleanup: async () => {
        if (!writerHarness || !baseline) {
          return;
        }

        await withFailureScreenshot(writerHarness.page, 'cleanup', async () => {
          await restoreGeneralSettings({
            page: writerHarness.page,
            baseUrl,
            baseline: baseline.general,
          });
          await restoreAuthSettings({
            page: writerHarness.page,
            baseUrl,
            baseline: baseline.auth,
          });
          await restoreStorageSettings({
            page: writerHarness.page,
            baseUrl,
            baseline: baseline.storage,
          });
        });
      },
    });

    console.log('Cloudflare admin settings smoke passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cloudflare admin settings smoke failed: ${message}`);

    const recentLogs = renderCloudflareLocalTopologyLogs(topology);
    if (recentLogs) {
      console.error(recentLogs);
    }

    process.exitCode = 1;
  } finally {
    if (writerHarness) {
      await closeAuthBrowserHarness(writerHarness).catch(() => undefined);
    }
    await topology?.stop();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
