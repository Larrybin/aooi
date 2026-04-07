import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  chromium,
  type BrowserContext,
  type CDPSession,
  type Page,
  type Response,
} from 'playwright';

import {
  createSurfaceResult,
  hasNoStoreHeader,
  hasSecureCookieFlags,
  summarizeFailureKinds,
  type ResponseCookieSummary,
  type ResponseSummary,
  type SurfaceName,
} from './auth-spike.shared';

export function stripOrigin(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function toFailureDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function buildAuthFailureDetail(params: {
  flow: 'sign-up' | 'sign-in';
  error: unknown;
  currentUrl: string;
  responses: ResponseSummary[];
}): string {
  const { flow, error, currentUrl, responses } = params;
  const authResponses =
    responses.length === 0
      ? 'none'
      : responses
          .map((response) => {
            const url = stripOrigin(response.url);
            return `${response.status} ${url}`;
          })
          .join(', ');

  return [
    toFailureDetail(error),
    `${flow} auth responses: ${authResponses}`,
    `${flow} final URL: ${currentUrl || 'n/a'}`,
  ].join('\n');
}

function isInsecureLocalPreviewOrigin(baseUrl: string): boolean {
  const url = new URL(baseUrl);
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  );
}

function isLocalNodeDevOrigin(baseUrl: string): boolean {
  const url = new URL(baseUrl);
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    url.port === '3100'
  );
}

type ParsedCookie = ResponseCookieSummary & {
  value: string;
  expires: number | undefined;
};

const CLEARED_COOKIE_EXPIRES_PATTERN =
  /expires=(thu, 01 jan 1970|thursday, 01 jan 1970)/i;

export function splitSetCookieHeader(header: string): string[] {
  const normalized = header
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return normalized.flatMap((part) => {
    const entries: string[] = [];
    let startIndex = 0;
    let inExpires = false;

    for (let index = 0; index < part.length; index += 1) {
      if (part.slice(index, index + 8).toLowerCase() === 'expires=') {
        inExpires = true;
        index += 7;
        continue;
      }

      const char = part[index];
      if (inExpires && char === ';') {
        inExpires = false;
        continue;
      }

      if (char !== ',' || inExpires) {
        continue;
      }

      const remainder = part.slice(index + 1).trimStart();
      if (!/^[!#$%&'*+\-.^_`|~0-9a-z]+=+/i.test(remainder)) {
        continue;
      }

      entries.push(part.slice(startIndex, index).trim());
      startIndex = index + 1;
    }

    entries.push(part.slice(startIndex).trim());
    return entries.filter(Boolean);
  });
}

function parseCookieHeader(setCookieHeader: string, baseUrl: string): ParsedCookie {
  const [pair, ...attributeParts] = setCookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
  const [name, ...valueParts] = pair.split('=');
  const value = valueParts.join('=');
  const attributes = new Map(
    attributeParts.map((item) => {
      const [key, ...rest] = item.split('=');
      return [key.toLowerCase(), rest.join('=')];
    })
  );
  const url = new URL(baseUrl);

  return {
    name,
    value,
    domain: attributes.get('domain') || url.hostname,
    path: attributes.get('path') || '/',
    secure: attributes.has('secure'),
    httpOnly: attributes.has('httponly'),
    sameSite: attributes.get('samesite')?.toLowerCase() || null,
    clearsCookie:
      attributes.get('max-age') === '0' ||
      CLEARED_COOKIE_EXPIRES_PATTERN.test(setCookieHeader),
    expires: attributes.has('max-age')
      ? Math.floor(Date.now() / 1000) + Number(attributes.get('max-age'))
      : undefined,
  };
}

export function parseSetCookieHeaders(
  setCookieHeaders: string[],
  baseUrl: string
): ParsedCookie[] {
  return setCookieHeaders.map((header) => parseCookieHeader(header, baseUrl));
}

export function buildResponseSummary({
  url,
  status,
  headers,
  setCookieHeaders,
}: {
  url: string;
  status: number;
  headers: Record<string, string>;
  setCookieHeaders: string[];
}): ResponseSummary {
  const cookies = parseSetCookieHeaders(setCookieHeaders, url).map(
    ({ value: _value, expires: _expires, ...cookie }) => cookie
  );

  return {
    url,
    status,
    cacheControl: headers['cache-control'] ?? null,
    contentType: headers['content-type'] ?? null,
    location: headers.location ?? null,
    headers,
    setCookieHeaderCount: setCookieHeaders.length,
    cookies,
    setCookiePresent: cookies.length > 0,
    clearsCookie: cookies.some((cookie) => cookie.clearsCookie),
  };
}

async function getSetCookieHeaders(response: Response): Promise<string[]> {
  try {
    const values = await response.headerValues('set-cookie');
    if (values.length > 0) {
      return values;
    }
  } catch {}

  let headers: Record<string, string> = {};

  try {
    headers = await response.allHeaders();
  } catch {
    headers = response.headers();
  }

  const setCookieHeader = headers['set-cookie'];
  return setCookieHeader ? splitSetCookieHeader(setCookieHeader) : [];
}

async function ensureDir(pathname: string) {
  await mkdir(pathname, { recursive: true });
}

async function captureFailure(
  page: Page,
  surface: SurfaceName,
  caseName: string,
  artifactDir: string
): Promise<string | null> {
  try {
    await ensureDir(artifactDir);
    const safeCase = caseName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const screenshotPath = resolve(
      artifactDir,
      `${surface}-${safeCase}-failure.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch {
    return null;
  }
}

async function summarizeResponse(response: Response): Promise<ResponseSummary> {
  let setCookieHeaders: string[] = [];
  let headers: Record<string, string> = {};

  try {
    headers = await response.allHeaders();
  } catch {
    headers = response.headers();
  }

  setCookieHeaders = await getSetCookieHeaders(response);

  return buildResponseSummary({
    url: response.url(),
    status: response.status(),
    headers,
    setCookieHeaders,
  });
}

function createAuthResponseRecorder(page: Page) {
  let active = false;
  let responses: ResponseSummary[] = [];
  let pending: Promise<void>[] = [];

  const handleResponse = (response: Response) => {
    if (!active || !response.url().includes('/api/auth/')) {
      return;
    }

    pending.push(
      summarizeResponse(response)
        .then((summary) => {
          responses.push(summary);
        })
        .catch(() => {})
    );
  };

  page.on('response', handleResponse);

  return {
    start() {
      active = true;
      responses = [];
      pending = [];
    },
    async stop() {
      active = false;
      await Promise.allSettled(pending);
      return [...responses];
    },
    dispose() {
      page.off('response', handleResponse);
    },
  };
}

async function waitForProtectedPage(page: Page, expectedPath: string) {
  await page.waitForURL(
    (url) => stripOrigin(url.toString()).startsWith(expectedPath),
    {
      timeout: 20_000,
    }
  );
}

async function waitForSignInPage(page: Page) {
  await page.waitForURL(
    (url) => stripOrigin(url.toString()).startsWith('/sign-in'),
    {
      timeout: 20_000,
    }
  );
}

async function waitForLocalNodeFormHydration(
  page: Page,
  baseUrl: string,
  formTestId: string
) {
  await page.locator(`[data-testid="${formTestId}"]`).waitFor({
    state: 'visible',
    timeout: 20_000,
  });

  if (!isLocalNodeDevOrigin(baseUrl)) {
    return;
  }

  await page
    .locator(
      `[data-testid="${formTestId}"][data-auth-client-ready="true"]`
    )
    .waitFor({
      state: 'visible',
      timeout: 20_000,
    });
}

async function signUpFreshAccount(
  page: Page,
  context: BrowserContext,
  cdpSession: CDPSession,
  callbackPathname: string,
  baseUrl: string,
  name: string,
  email: string,
  password: string,
  recorder: ReturnType<typeof createAuthResponseRecorder>
) {
  const origin = new URL(baseUrl).origin;

  await page.goto(
    `${origin}/sign-up?callbackUrl=${encodeURIComponent(callbackPathname)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForLocalNodeFormHydration(page, baseUrl, 'auth-sign-up-form');
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  recorder.start();
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/auth/sign-up/email')
  );
  await page.locator('[data-testid="auth-sign-up-submit"]').click({
    noWaitAfter: true,
  });
  const response = await responsePromise;
  await bridgeSessionCookieIfNeeded({
    page,
    context,
    cdpSession,
    baseUrl,
    response,
  });
  await ensureProtectedPageNavigation(page, baseUrl, callbackPathname);

  return recorder.stop();
}

async function signInExistingAccount(
  page: Page,
  context: BrowserContext,
  cdpSession: CDPSession,
  callbackPathname: string,
  baseUrl: string,
  email: string,
  password: string,
  recorder: ReturnType<typeof createAuthResponseRecorder>
) {
  const origin = new URL(baseUrl).origin;

  await page.goto(
    `${origin}/sign-in?callbackUrl=${encodeURIComponent(callbackPathname)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForLocalNodeFormHydration(page, baseUrl, 'auth-sign-in-form');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  recorder.start();
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/auth/sign-in/email')
  );
  await page.locator('[data-testid="auth-sign-in-submit"]').click({
    noWaitAfter: true,
  });
  const response = await responsePromise;
  await bridgeSessionCookieIfNeeded({
    page,
    context,
    cdpSession,
    baseUrl,
    response,
  });
  await ensureProtectedPageNavigation(page, baseUrl, callbackPathname);

  return recorder.stop();
}

async function ensureProtectedPageNavigation(
  page: Page,
  baseUrl: string,
  callbackPathname: string
) {
  try {
    await waitForProtectedPage(page, callbackPathname);
    return;
  } catch (error) {
    const currentPath = stripOrigin(page.url());
    if (!/^\/sign-in(\?|$)/.test(currentPath)) {
      throw error;
    }
  }

  await page.goto(`${baseUrl}${callbackPathname}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForProtectedPage(page, callbackPathname);
}

async function bridgeSessionCookieIfNeeded(params: {
  page: Page;
  context: BrowserContext;
  cdpSession: CDPSession;
  baseUrl: string;
  response: Response;
}) {
  const { context, cdpSession, baseUrl, response } = params;
  if (!isInsecureLocalPreviewOrigin(baseUrl)) {
    return;
  }

  let setCookieHeaders: string[] = [];

  setCookieHeaders = await getSetCookieHeaders(response);
  if (setCookieHeaders.length === 0) {
    return;
  }

  const cookie = parseSetCookieHeaders(setCookieHeaders, baseUrl).find((item) =>
    item.name.startsWith('__Secure-better-auth.')
  );

  if (!cookie) {
    return;
  }

  if (!cookie.name.startsWith('__Secure-better-auth.')) {
    return;
  }

  const hasCookie = (await context.cookies())
    .some((item) => item.name === cookie.name && item.domain === cookie.domain);

  if (hasCookie) {
    return;
  }

  await cdpSession.send('Network.setCookie', {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite:
      cookie.sameSite === 'none'
        ? 'None'
        : cookie.sameSite === 'strict'
          ? 'Strict'
          : 'Lax',
    expires: cookie.expires,
    sourceScheme: 'Secure',
    sourcePort: 443,
  });
}

async function bridgeClearedSessionCookieIfNeeded(params: {
  context: BrowserContext;
  cdpSession: CDPSession;
  baseUrl: string;
  responses: ResponseSummary[];
}) {
  const { context, cdpSession, baseUrl, responses } = params;
  if (!isInsecureLocalPreviewOrigin(baseUrl)) {
    return;
  }

  const clearCookieResponse = [...responses]
    .reverse()
    .find(
      (response) =>
        response.cookies.some(
          (cookie) =>
            cookie.clearsCookie &&
            cookie.name.startsWith('__Secure-better-auth.')
        )
    );

  if (!clearCookieResponse) {
    return;
  }

  const cookie = clearCookieResponse.cookies.find(
    (item) =>
      item.clearsCookie && item.name.startsWith('__Secure-better-auth.')
  );

  if (!cookie) {
    return;
  }

  await cdpSession.send('Network.deleteCookies', {
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
  });

  await context.clearCookies({
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
  });
}

async function recordCase(
  page: Page,
  surface: ReturnType<typeof createSurfaceResult>,
  name: string,
  artifactDir: string,
  action: () => Promise<string | void>
) {
  try {
    const detail = (await action()) || 'ok';
    surface.cases.push({
      name,
      status: 'passed',
      detail,
      screenshotPath: null,
    });
  } catch (error: unknown) {
    surface.cases.push({
      name,
      status: 'failed',
      detail: toFailureDetail(error),
      screenshotPath: await captureFailure(
        page,
        surface.surface,
        name,
        artifactDir
      ),
    });
    throw error;
  }
}

export type AuthBrowserHarness = {
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  context: BrowserContext;
  page: Page;
  cdpSession: CDPSession;
  recorder: ReturnType<typeof createAuthResponseRecorder>;
};

export async function createAuthBrowserHarness(): Promise<AuthBrowserHarness> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdpSession = await context.newCDPSession(page);
  const recorder = createAuthResponseRecorder(page);

  return {
    browser,
    context,
    page,
    cdpSession,
    recorder,
  };
}

export async function closeAuthBrowserHarness(
  harness: AuthBrowserHarness
): Promise<void> {
  harness.recorder.dispose();
  await harness.context.close();
  await harness.browser.close();
}

export async function signUpWithAuthBrowserHarness(params: {
  harness: AuthBrowserHarness;
  baseUrl: string;
  email: string;
  password: string;
  callbackPath: string;
  userName: string;
}): Promise<{ responses: ResponseSummary[]; finalUrl: string }> {
  const { harness, baseUrl, email, password, callbackPath, userName } = params;
  const responses = await signUpFreshAccount(
    harness.page,
    harness.context,
    harness.cdpSession,
    callbackPath,
    baseUrl,
    userName,
    email,
    password,
    harness.recorder
  );

  return {
    responses,
    finalUrl: stripOrigin(harness.page.url()),
  };
}

export async function signInWithAuthBrowserHarness(params: {
  harness: AuthBrowserHarness;
  baseUrl: string;
  email: string;
  password: string;
  callbackPath: string;
}): Promise<{ responses: ResponseSummary[]; finalUrl: string }> {
  const { harness, baseUrl, email, password, callbackPath } = params;
  const responses = await signInExistingAccount(
    harness.page,
    harness.context,
    harness.cdpSession,
    callbackPath,
    baseUrl,
    email,
    password,
    harness.recorder
  );

  return {
    responses,
    finalUrl: stripOrigin(harness.page.url()),
  };
}

export async function runAuthSurface(params: {
  surfaceName: SurfaceName;
  baseUrl: string;
  emailUsed: string;
  password: string;
  callbackPath: string;
  userName: string;
  artifactDir: string;
}) {
  const { surfaceName, baseUrl, emailUsed, password, callbackPath, userName } =
    params;
  const harness = await createAuthBrowserHarness();
  const { context, page, cdpSession, recorder } = harness;
  const surfaceResult = createSurfaceResult(surfaceName, baseUrl, emailUsed);

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    await recordCase(
      page,
      surfaceResult,
      'sign_up_fresh_account',
      params.artifactDir,
      async () => {
        try {
          surfaceResult.signUpResponses = await signUpFreshAccount(
            page,
            context,
            cdpSession,
            callbackPath,
            baseUrl,
            userName,
            emailUsed,
            password,
            recorder
          );
        } catch (error) {
          surfaceResult.signUpResponses = await recorder.stop();
          throw new Error(
            buildAuthFailureDetail({
              flow: 'sign-up',
              error,
              currentUrl: stripOrigin(page.url()),
              responses: surfaceResult.signUpResponses,
            }),
            { cause: error instanceof Error ? error : undefined }
          );
        }
        surfaceResult.finalUrlAfterSignUp = stripOrigin(page.url());

        assert.equal(
          surfaceResult.finalUrlAfterSignUp,
          callbackPath,
          `注册后应跳转到 callbackUrl (${callbackPath})`
        );
        assert.equal(
          hasNoStoreHeader(surfaceResult.signUpResponses),
          true,
          'sign-up auth 响应必须带 no-store'
        );
        assert.equal(
          hasSecureCookieFlags(surfaceResult.signUpResponses),
          true,
          'sign-up auth 响应必须包含完整 cookie 安全属性'
        );

        return `created ${emailUsed} and redirected to ${surfaceResult.finalUrlAfterSignUp}`;
      }
    );

    await recordCase(
      page,
      surfaceResult,
      'sign_in_after_fresh_signup',
      params.artifactDir,
      async () => {
        await context.clearCookies();
        try {
          surfaceResult.signInResponses = await signInExistingAccount(
            page,
            context,
            cdpSession,
            callbackPath,
            baseUrl,
            emailUsed,
            password,
            recorder
          );
        } catch (error) {
          surfaceResult.signInResponses = await recorder.stop();
          throw new Error(
            buildAuthFailureDetail({
              flow: 'sign-in',
              error,
              currentUrl: stripOrigin(page.url()),
              responses: surfaceResult.signInResponses,
            }),
            { cause: error instanceof Error ? error : undefined }
          );
        }
        surfaceResult.finalUrlAfterSignIn = stripOrigin(page.url());

        assert.equal(
          surfaceResult.finalUrlAfterSignIn,
          callbackPath,
          `登录后应跳转到 callbackUrl (${callbackPath})`
        );
        assert.equal(
          hasNoStoreHeader(surfaceResult.signInResponses),
          true,
          'sign-in auth 响应必须带 no-store'
        );
        assert.equal(
          hasSecureCookieFlags(surfaceResult.signInResponses),
          true,
          'sign-in auth 响应必须包含完整 cookie 安全属性'
        );

        return `signed in ${emailUsed} and redirected to ${surfaceResult.finalUrlAfterSignIn}`;
      }
    );

    await recordCase(
      page,
      surfaceResult,
      'session_read_happy_path',
      params.artifactDir,
      async () => {
        await page.goto(`${baseUrl}${callbackPath}`, {
          waitUntil: 'domcontentloaded',
        });
        await page.locator('[data-testid="settings-profile-page"]').waitFor({
          state: 'visible',
          timeout: 20_000,
        });

        return 'protected profile page is visible';
      }
    );

    await recordCase(
      page,
      surfaceResult,
      'invalid_session_failure_path',
      params.artifactDir,
      async () => {
        await context.clearCookies();
        await page.goto(`${baseUrl}${callbackPath}`, {
          waitUntil: 'domcontentloaded',
        });
        await waitForSignInPage(page);
        surfaceResult.finalUrlAfterInvalidCookie = stripOrigin(page.url());

        assert.match(
          surfaceResult.finalUrlAfterInvalidCookie,
          /^\/sign-in(\?|$)/,
          '无效 cookie 应重定向到 sign-in'
        );

        return `redirected to ${surfaceResult.finalUrlAfterInvalidCookie}`;
      }
    );

    await recordCase(
      page,
      surfaceResult,
      'sign_out',
      params.artifactDir,
      async () => {
        await signInExistingAccount(
          page,
          context,
          cdpSession,
          callbackPath,
          baseUrl,
          emailUsed,
          password,
          recorder
        );
        await page
          .locator('[data-testid="auth-user-menu-trigger"]')
          .first()
          .click();
        recorder.start();
        await page
          .locator('[data-testid="auth-sign-out-trigger"]')
          .first()
          .click({ noWaitAfter: true });
        await page.waitForURL(
          (url) => !stripOrigin(url.toString()).startsWith(callbackPath),
          { timeout: 20_000 }
        );

        surfaceResult.signOutResponses = await recorder.stop();
        await bridgeClearedSessionCookieIfNeeded({
          context,
          cdpSession,
          baseUrl,
          responses: surfaceResult.signOutResponses,
        });
        surfaceResult.finalUrlAfterSignOut = stripOrigin(page.url());

        assert.equal(
          hasNoStoreHeader(surfaceResult.signOutResponses),
          true,
          'sign-out auth 响应必须带 no-store'
        );
        assert.equal(
          hasSecureCookieFlags(surfaceResult.signOutResponses),
          true,
          'sign-out auth 响应必须包含完整 cookie 安全属性'
        );
        assert.equal(
          surfaceResult.signOutResponses.some(
            (response) => response.clearsCookie
          ),
          true,
          'sign-out auth 响应必须清除 session cookie'
        );

        await page.goto(`${baseUrl}${callbackPath}`, {
          waitUntil: 'domcontentloaded',
        });
        await waitForSignInPage(page);

        return `signed out to ${surfaceResult.finalUrlAfterSignOut || 'unknown'}`;
      }
    );
  } catch {
    summarizeFailureKinds(surfaceResult);
  } finally {
    summarizeFailureKinds(surfaceResult);
    await closeAuthBrowserHarness(harness);
  }

  return surfaceResult;
}
