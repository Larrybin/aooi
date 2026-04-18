import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  chromium,
  type APIResponse,
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
  type SessionObservation,
  type ResponseCookieSummary,
  type ResponseSummary,
  type SurfaceName,
} from './auth-spike.shared';

export function stripOrigin(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function toPathWithSearch(urlOrPath: string): string {
  if (urlOrPath.startsWith('/')) {
    return urlOrPath;
  }

  return stripOrigin(urlOrPath);
}

export function hasAuthErrorQuery(urlOrPath: string): boolean {
  try {
    const pathWithSearch = toPathWithSearch(urlOrPath);
    const parsed = new URL(`https://auth-spike.local${pathWithSearch}`);
    return parsed.searchParams.has('error');
  } catch {
    return false;
  }
}

export function isSignInPath(urlOrPath: string): boolean {
  try {
    return /^\/sign-in(\?|$)/.test(toPathWithSearch(urlOrPath));
  } catch {
    return false;
  }
}

export function isAuthCallbackPath(urlOrPath: string): boolean {
  try {
    return /^\/api\/auth\/callback\//.test(toPathWithSearch(urlOrPath));
  } catch {
    return false;
  }
}

export function isTerminalAuthErrorUrl(urlOrPath: string): boolean {
  return (
    hasAuthErrorQuery(urlOrPath) &&
    isSignInPath(urlOrPath) &&
    !isAuthCallbackPath(urlOrPath)
  );
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

function isTransientLocalDbFailure(
  observation: SessionObservation,
  baseUrl: string
): boolean {
  if (!isInsecureLocalPreviewOrigin(baseUrl)) {
    return false;
  }

  if (observation.status !== 500) {
    return false;
  }

  if (observation.bodySnippet === 'n/a' || observation.bodySnippet.trim() === '') {
    return true;
  }

  return /DB_STARTUP_CHECK_FAILED|database temporarily unavailable|MaxClientsInSessionMode/i.test(
    observation.bodySnippet
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function summarizeApiResponse(
  response: APIResponse
): Promise<ResponseSummary> {
  const headers = response.headers();
  return buildResponseSummary({
    url: response.url(),
    status: response.status(),
    headers,
    setCookieHeaders: headers['set-cookie']
      ? splitSetCookieHeader(headers['set-cookie'])
      : [],
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function buildSessionObservation(params: {
  bodyText: string;
  headers: Record<string, string>;
  status: number;
  url: string;
}): SessionObservation {
  let parsedBody: unknown = null;

  try {
    parsedBody = JSON.parse(params.bodyText);
  } catch {}

  const body = isRecord(parsedBody) ? parsedBody : null;

  return {
    url: params.url,
    status: params.status,
    headers: params.headers,
    bodySnippet: params.bodyText ? params.bodyText.slice(0, 500) : 'n/a',
    sessionPresent: isRecord(body?.session),
    userPresent: isRecord(body?.user),
  };
}

export async function getSessionViaAuthApi(
  context: BrowserContext,
  baseUrl: string
): Promise<SessionObservation> {
  const origin = new URL(baseUrl).origin;
  const maxAttempts = isInsecureLocalPreviewOrigin(baseUrl) ? 3 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await context.request.get(`${baseUrl}/api/auth/get-session`, {
      failOnStatusCode: false,
      maxRedirects: 0,
      headers: {
        origin,
        referer: `${origin}/`,
      },
    });
    let bodyText = '';

    try {
      bodyText = await response.text();
    } catch {}

    const observation = buildSessionObservation({
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      bodyText,
    });

    if (
      attempt < maxAttempts &&
      isTransientLocalDbFailure(observation, baseUrl)
    ) {
      await sleep(1500);
      continue;
    }

    return observation;
  }

  throw new Error('getSessionViaAuthApi exhausted all attempts unexpectedly');
}

export async function signOutViaAuthApi(
  context: BrowserContext,
  baseUrl: string
): Promise<ResponseSummary> {
  const origin = new URL(baseUrl).origin;
  const response = await context.request.post(`${baseUrl}/api/auth/sign-out`, {
    failOnStatusCode: false,
    maxRedirects: 0,
    headers: {
      'content-type': 'application/json',
      origin,
      referer: `${origin}/`,
    },
    data: {},
  });

  return summarizeApiResponse(response);
}

export function assertSignedInSession(
  observation: SessionObservation,
  label = 'session 应处于已登录状态'
) {
  assert.equal(
    observation.status,
    200,
    `${label}: get-session 应返回 200，实际 ${observation.status}`
  );
  assert.equal(
    observation.sessionPresent,
    true,
    `${label}: get-session 应返回 session，body=${observation.bodySnippet}`
  );
  assert.equal(
    observation.userPresent,
    true,
    `${label}: get-session 应返回 user，body=${observation.bodySnippet}`
  );
}

export function assertSignedOutSession(
  observation: SessionObservation,
  label = 'session 应处于已登出状态'
) {
  assert.equal(
    observation.status,
    200,
    `${label}: get-session 应返回 200，实际 ${observation.status}`
  );
  assert.equal(
    observation.sessionPresent,
    false,
    `${label}: get-session 不应返回 session，body=${observation.bodySnippet}`
  );
  assert.equal(
    observation.userPresent,
    false,
    `${label}: get-session 不应返回 user，body=${observation.bodySnippet}`
  );
}

export function createAuthResponseRecorder(page: Page) {
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

export async function waitForProtectedPage(page: Page, expectedPath: string) {
  await page.waitForURL(
    (url) => stripOrigin(url.toString()).startsWith(expectedPath),
    {
      timeout: 20_000,
      waitUntil: 'commit',
    }
  );
}

export async function waitForSignInPage(page: Page) {
  await page.waitForURL(
    (url) => stripOrigin(url.toString()).startsWith('/sign-in'),
    {
      timeout: 20_000,
      waitUntil: 'commit',
    }
  );
}

export async function waitForTerminalAuthErrorPage(page: Page) {
  await page.waitForURL((url) => isTerminalAuthErrorUrl(url.toString()), {
    timeout: 20_000,
    waitUntil: 'commit',
  });
}

async function waitForProtectedOrSignInPage(
  page: Page,
  expectedPath: string
) {
  await page.waitForURL(
    (url) => {
      const pathname = stripOrigin(url.toString());
      return (
        pathname.startsWith(expectedPath) || /^\/sign-in(\?|$)/.test(pathname)
      );
    },
    {
      timeout: 20_000,
      waitUntil: 'commit',
    }
  );
}

async function waitForLocalNodeFormHydration(
  page: Page,
  baseUrl: string,
  formTestId: string
) {
  const formLocator = page.locator(`[data-testid="${formTestId}"]`);
  await formLocator.waitFor({
    state: 'visible',
    timeout: 20_000,
  });

  const readyState = await formLocator.getAttribute('data-auth-client-ready');
  if (readyState !== null) {
    await page.waitForFunction(
      ({ selector }) =>
        document.querySelector(selector)?.getAttribute('data-auth-client-ready') ===
        'true',
      {
        selector: `[data-testid="${formTestId}"]`,
      },
      { timeout: 20_000 }
    );
    return;
  }

  if (!isLocalNodeDevOrigin(baseUrl)) {
    return;
  }

  await expectAuthClientReadyAttribute(formLocator, formTestId);
}

async function expectAuthClientReadyAttribute(
  formLocator: ReturnType<Page['locator']>,
  formTestId: string
) {
  await formLocator.waitFor({
    state: 'visible',
    timeout: 20_000,
  });

  const readyState = await formLocator.getAttribute('data-auth-client-ready');
  if (readyState !== 'true') {
    throw new Error(
      `[${formTestId}] auth form rendered before client hydration completed`
    );
  }
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

  return recorder.stop();
}

export async function ensureProtectedPageNavigation(
  page: Page,
  baseUrl: string,
  callbackPathname: string
) {
  await waitForProtectedOrSignInPage(page, callbackPathname);

  const currentPath = stripOrigin(page.url());
  if (currentPath.startsWith(callbackPathname)) {
    return;
  }

  if (!/^\/sign-in(\?|$)/.test(currentPath)) {
    throw new Error(
      `unexpected auth navigation target: ${currentPath || 'n/a'}`
    );
  }

  await page.goto(`${baseUrl}${callbackPathname}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForProtectedPage(page, callbackPathname);
}

export async function bridgeSessionCookieIfNeeded(params: {
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

  const cookiesToBridge = parseSetCookieHeaders(setCookieHeaders, baseUrl).filter(
    (item) =>
      item.name.startsWith('__Secure-better-auth.') && !item.clearsCookie
  );

  if (cookiesToBridge.length === 0) {
    return;
  }

  const existingCookies = await context.cookies();

  for (const cookie of cookiesToBridge) {
    const hasCookie = existingCookies.some(
      (item) => item.name === cookie.name && item.domain === cookie.domain
    );

    if (hasCookie) {
      continue;
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
}

export async function bridgeClearedSessionCookieIfNeeded(params: {
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
        surfaceResult.sessionAfterSignUp = await getSessionViaAuthApi(
          context,
          baseUrl
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
        assertSignedInSession(
          surfaceResult.sessionAfterSignUp,
          'sign-up 后 session 应可通过同源 auth API 读取'
        );

        return `created ${emailUsed} and established session via /api/auth/get-session`;
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
        surfaceResult.sessionAfterSignIn = await getSessionViaAuthApi(
          context,
          baseUrl
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
        assertSignedInSession(
          surfaceResult.sessionAfterSignIn,
          'sign-in 后 session 应可通过同源 auth API 读取'
        );

        return `signed in ${emailUsed} and established session via /api/auth/get-session`;
      }
    );

    await recordCase(
      page,
      surfaceResult,
      'session_read_happy_path',
      params.artifactDir,
      async () => {
        const observation = await getSessionViaAuthApi(context, baseUrl);
        assertSignedInSession(
          observation,
          'session_read_happy_path 应持续返回已登录 session'
        );

        return 'session remains readable via /api/auth/get-session';
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
        const signOutResponse = await signOutViaAuthApi(context, baseUrl);
        surfaceResult.signOutResponses = [signOutResponse];
        await bridgeClearedSessionCookieIfNeeded({
          context,
          cdpSession,
          baseUrl,
          responses: surfaceResult.signOutResponses,
        });
        surfaceResult.finalUrlAfterSignOut = stripOrigin(page.url());
        surfaceResult.sessionAfterSignOut = await getSessionViaAuthApi(
          context,
          baseUrl
        );

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
        assertSignedOutSession(
          surfaceResult.sessionAfterSignOut,
          'sign-out 后 session 应被清除'
        );

        return 'signed out and confirmed via /api/auth/get-session';
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
