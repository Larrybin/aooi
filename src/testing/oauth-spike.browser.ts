import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  APIResponse,
  BrowserContext,
  Page,
  Request,
  Response,
  Route,
} from 'playwright';

import {
  assertSignedInSession,
  assertSignedOutSession,
  bridgeClearedSessionCookieIfNeeded,
  bridgeSessionCookieIfNeeded,
  buildResponseSummary,
  closeAuthBrowserHarness,
  createAuthBrowserHarness,
  createAuthResponseRecorder,
  ensureProtectedPageNavigation,
  getSessionViaAuthApi,
  isTerminalAuthErrorUrl,
  signOutViaAuthApi,
  splitSetCookieHeader,
  stripOrigin,
  waitForTerminalAuthErrorPage,
} from './auth-spike.browser';
import {
  hasNoStoreHeader,
  hasSecureCookieFlags,
  type BrowserContextCookieSummary,
  type PreflightCheck,
  type ResponseSummary,
} from './auth-spike.shared';
import {
  createOAuthProviderResult,
  summarizeOAuthFailureKinds,
  type OAuthCaseName,
  type OAuthProviderName,
  type OAuthProviderResult,
  type ProtectedRequestObservation,
} from './oauth-spike.shared';

const PROVIDERS: Array<{
  authorizeUrlPrefix: string;
  buttonTestId: string;
  id: OAuthProviderName;
}> = [
  {
    id: 'google',
    buttonTestId: 'auth-social-google',
    authorizeUrlPrefix: 'https://accounts.google.com/o/oauth2/auth',
  },
  {
    id: 'github',
    buttonTestId: 'auth-social-github',
    authorizeUrlPrefix: 'https://github.com/login/oauth/authorize',
  },
];

function toFailureDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function resolveStrictSameOriginRedirectLocation(
  rawLocation: string,
  requestUrl: string
): string {
  const trimmedLocation = rawLocation.trim();
  let resolvedLocation: URL;
  let requestOrigin: string;

  try {
    requestOrigin = new URL(requestUrl).origin;
    resolvedLocation = new URL(trimmedLocation, requestUrl);
  } catch (error) {
    throw new Error(
      `invalid location: rawLocation=${trimmedLocation || 'n/a'} requestUrl=${requestUrl} error=${toFailureDetail(error)}`
    );
  }

  if (resolvedLocation.origin !== requestOrigin) {
    throw new Error(
      `cross-origin location: rawLocation=${trimmedLocation || 'n/a'} requestUrl=${requestUrl} resolvedLocation=${resolvedLocation.toString()}`
    );
  }

  return resolvedLocation.toString();
}

async function resolveOAuthFailureRedirect(params: {
  callbackUrl: string;
  context: BrowserContext;
  provider: OAuthProviderName;
}): Promise<string> {
  let requestUrl = params.callbackUrl;

  for (let hop = 0; hop < 4; hop += 1) {
    const redirectStep = await requestAuthRedirectStep({
      context: params.context,
      provider: params.provider,
      requestUrl,
    });
    const { bodySnippet, location, response } = redirectStep;
    const responseUrl = response.url();

    if (isTerminalAuthErrorUrl(responseUrl)) {
      return responseUrl;
    }

    assert.equal(
      response.status(),
      302,
      `[${params.provider}] OAuth callback 失败路径必须返回 302 或终态错误页 response-url=${responseUrl} location=${location || 'n/a'} body=${bodySnippet}`
    );
    assert(
      location,
      `[${params.provider}] OAuth callback 失败路径必须返回 location header response-url=${responseUrl} request-url=${requestUrl} body=${bodySnippet}`
    );

    let nextRequestUrl: string;
    try {
      nextRequestUrl = resolveStrictSameOriginRedirectLocation(
        location,
        requestUrl
      );
    } catch (error) {
      throw new Error(
        `[${params.provider}] OAuth callback 失败路径返回非法 redirect response-url=${responseUrl} request-url=${requestUrl} raw-location=${location} body=${bodySnippet} cause=${toFailureDetail(error)}`
      );
    }

    if (isTerminalAuthErrorUrl(nextRequestUrl)) {
      return nextRequestUrl;
    }

    requestUrl = nextRequestUrl;
  }

  throw new Error(
    `[${params.provider}] OAuth callback 失败跳转未在预期 hop 内收敛到终态错误页 callback-url=${params.callbackUrl}`
  );
}

function createProviderPath(provider: OAuthProviderName) {
  return `/api/auth/callback/${provider}`;
}

type SocialSignInResult = {
  authorizationUrl: string;
  responseBody: string;
  responseUrl: string;
  originDebug: string;
};

async function captureFailure(
  page: Page,
  provider: OAuthProviderName,
  caseName: OAuthCaseName,
  artifactDir: string
) {
  try {
    await mkdir(artifactDir, { recursive: true });
    const screenshotPath = resolve(
      artifactDir,
      `${provider}-${caseName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-failure.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch {
    return null;
  }
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
  return setCookieHeader
    ? setCookieHeader
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

async function summarizeResponse(response: Response): Promise<ResponseSummary> {
  let headers: Record<string, string> = {};

  try {
    headers = await response.allHeaders();
  } catch {
    headers = response.headers();
  }

  return buildResponseSummary({
    url: response.url(),
    status: response.status(),
    headers,
    setCookieHeaders: await getSetCookieHeaders(response),
  });
}

async function getApiSetCookieHeaders(
  response: APIResponse
): Promise<string[]> {
  const setCookieHeader = response.headers()['set-cookie'];
  return setCookieHeader ? splitSetCookieHeader(setCookieHeader) : [];
}

async function summarizeApiResponse(
  response: APIResponse
): Promise<ResponseSummary> {
  return buildResponseSummary({
    url: response.url(),
    status: response.status(),
    headers: response.headers(),
    setCookieHeaders: await getApiSetCookieHeaders(response),
  });
}

async function requestAuthRedirectStep(params: {
  context: BrowserContext;
  provider: OAuthProviderName;
  requestUrl: string;
}): Promise<{
  bodySnippet: string;
  location: string | null;
  response: APIResponse;
  setCookieHeaders: string[];
  summary: ResponseSummary;
}> {
  const response: APIResponse = await params.context.request.get(
    params.requestUrl,
    {
      failOnStatusCode: false,
      maxRedirects: 0,
    }
  );
  let bodySnippet = 'n/a';

  try {
    bodySnippet = (await response.text()).slice(0, 500);
  } catch (error) {
    bodySnippet = `unavailable: ${toFailureDetail(error)}`;
  }

  const setCookieHeaders = await getApiSetCookieHeaders(response);

  return {
    bodySnippet,
    location: response.headers().location?.trim() || null,
    response,
    setCookieHeaders,
    summary: await summarizeApiResponse(response),
  };
}

async function summarizeContextCookies(
  context: BrowserContext,
  url: string
): Promise<BrowserContextCookieSummary[]> {
  return (await context.cookies([url]))
    .map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite || null,
      expires:
        Number.isFinite(cookie.expires) && cookie.expires > 0
          ? cookie.expires
          : null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function inspectProtectedRequest(params: {
  callbackPath: string;
  context: BrowserContext;
  baseUrl: string;
}): Promise<ProtectedRequestObservation> {
  const url = `${params.baseUrl}${params.callbackPath}`;
  const response: APIResponse = await params.context.request.get(url, {
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  let bodySnippet = 'n/a';

  try {
    bodySnippet = (await response.text()).slice(0, 500);
  } catch (error) {
    bodySnippet = `unavailable: ${toFailureDetail(error)}`;
  }

  return {
    url,
    status: response.status(),
    location: response.headers().location || null,
    bodySnippet,
  };
}

async function waitForSocialProviderButton(
  page: Page,
  buttonTestId: string
): Promise<void> {
  await page.locator(`[data-testid="${buttonTestId}"]`).waitFor({
    state: 'visible',
    timeout: 20_000,
  });
}

async function openSignInAndWaitForSocialProviderButton(params: {
  baseUrl: string;
  buttonTestId: string;
  callbackPath: string;
  page: Page;
}) {
  await params.page.goto(
    `${params.baseUrl}/sign-in?callbackUrl=${encodeURIComponent(params.callbackPath)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForSocialProviderButton(params.page, params.buttonTestId);
}

function inspectAuthorizationUrl(params: {
  authorizationUrl: string;
  baseUrl: string;
  provider: OAuthProviderName;
}) {
  const providerConfig = PROVIDERS.find((item) => item.id === params.provider);
  assert(providerConfig, `unknown provider: ${params.provider}`);

  const authorizationUrl = new URL(params.authorizationUrl);
  const redirectUri = authorizationUrl.searchParams.get('redirect_uri');
  const state = authorizationUrl.searchParams.get('state');

  assert.equal(
    `${authorizationUrl.origin}${authorizationUrl.pathname}`,
    providerConfig.authorizeUrlPrefix,
    `[${params.provider}] provider authorization URL 不符合预期`
  );
  assert(redirectUri, `[${params.provider}] redirect_uri 缺失`);
  assert(state, `[${params.provider}] state 缺失`);

  const redirectUrl = new URL(redirectUri);
  const baseOrigin = new URL(params.baseUrl).origin;

  assert.equal(
    redirectUrl.origin,
    baseOrigin,
    `[${params.provider}] redirect_uri 必须回到当前 Cloudflare preview origin`
  );
  assert.equal(
    redirectUrl.pathname,
    createProviderPath(params.provider),
    `[${params.provider}] redirect_uri 路径必须是 ${createProviderPath(params.provider)}`
  );

  return {
    redirectUri,
    state,
  };
}

async function clickSocialProviderAndCaptureAuthorizationUrl(params: {
  onSignInResponse?: (response: Response) => Promise<void>;
  page: Page;
  provider: OAuthProviderName;
}): Promise<SocialSignInResult> {
  const providerConfig = PROVIDERS.find((item) => item.id === params.provider);
  assert(providerConfig, `unknown provider: ${params.provider}`);

  const authorizationRequestPromise: Promise<Request | Error> = params.page
    .waitForEvent('request', {
      predicate: (request: Request) =>
        request.url().startsWith(providerConfig.authorizeUrlPrefix),
      timeout: 20_000,
    })
    .catch((error: unknown) =>
      error instanceof Error ? error : new Error(String(error))
    );
  const signInResponsePromise: Promise<Response | Error> = params.page
    .waitForResponse(
      (response) => response.url().includes('/api/auth/sign-in/social'),
      { timeout: 20_000 }
    )
    .catch((error: unknown) =>
      error instanceof Error ? error : new Error(String(error))
    );

  await params.page
    .locator(`[data-testid="${providerConfig.buttonTestId}"]`)
    .click({
      noWaitAfter: true,
    });

  const signInResponse = await signInResponsePromise;
  if (signInResponse instanceof Error) {
    throw signInResponse;
  }
  if (!signInResponse.ok()) {
    const request = signInResponse.request();
    const headers = request.headers();
    const debugHeader =
      (await signInResponse.headerValue('x-auth-spike-origin-debug')) || 'n/a';
    throw new Error(
      `[${params.provider}] sign-in/social ${signInResponse.status()}: ${(
        await signInResponse.text()
      ).slice(
        0,
        500
      )} request-origin=${headers.origin || 'n/a'} request-referer=${headers.referer || 'n/a'} request-body=${request.postData() || 'n/a'} auth-debug=${debugHeader}`
    );
  }

  if (params.onSignInResponse) {
    await params.onSignInResponse(signInResponse);
  }

  const request = await authorizationRequestPromise;
  if (request instanceof Error) {
    throw request;
  }

  let responseBody = 'n/a';

  try {
    responseBody = (await signInResponse.text()).slice(0, 1000);
  } catch (error) {
    responseBody = `unavailable: ${toFailureDetail(error)}`;
  }

  return {
    authorizationUrl: request.url(),
    responseBody,
    responseUrl: signInResponse.url(),
    originDebug:
      (await signInResponse.headerValue('x-auth-spike-origin-debug')) || 'n/a',
  };
}

async function withAuthorizationRoute<T>({
  handler,
  page,
  provider,
  run,
}: {
  handler: (route: Route, authUrl: URL) => Promise<void>;
  page: Page;
  provider: OAuthProviderName;
  run: () => Promise<T>;
}) {
  const providerConfig = PROVIDERS.find((item) => item.id === provider);
  assert(providerConfig, `unknown provider: ${provider}`);

  const routeHandler = async (route: Route) => {
    await handler(route, new URL(route.request().url()));
  };

  await page.route(`${providerConfig.authorizeUrlPrefix}*`, routeHandler);

  try {
    return await run();
  } finally {
    await page.unroute(`${providerConfig.authorizeUrlPrefix}*`, routeHandler);
  }
}

async function startProviderFlowFromSignIn(params: {
  baseUrl: string;
  callbackPath: string;
  handler: (route: Route, authUrl: URL) => Promise<void>;
  onSignInResponse?: (response: Response) => Promise<void>;
  page: Page;
  provider: OAuthProviderName;
}) {
  const providerConfig = PROVIDERS.find((item) => item.id === params.provider);
  assert(providerConfig, `unknown provider: ${params.provider}`);

  let resolveBeforeAuthorizationRedirect: (() => void) | null = null;
  const beforeAuthorizationRedirect = new Promise<void>((resolve) => {
    resolveBeforeAuthorizationRedirect = resolve;
  });

  await openSignInAndWaitForSocialProviderButton({
    baseUrl: params.baseUrl,
    callbackPath: params.callbackPath,
    page: params.page,
    buttonTestId: providerConfig.buttonTestId,
  });

  return await withAuthorizationRoute({
    page: params.page,
    provider: params.provider,
    handler: async (route, authUrl) => {
      await beforeAuthorizationRedirect;
      await params.handler(route, authUrl);
    },
    run: async () =>
      await clickSocialProviderAndCaptureAuthorizationUrl({
        page: params.page,
        provider: params.provider,
        onSignInResponse: async (response) => {
          try {
            await params.onSignInResponse?.(response);
          } finally {
            resolveBeforeAuthorizationRedirect?.();
          }
        },
      }),
  });
}

async function recordCase(params: {
  action: () => Promise<string | void>;
  artifactDir: string;
  caseName: OAuthCaseName;
  page: Page;
  providerResult: OAuthProviderResult;
}) {
  try {
    const detail = (await params.action()) || 'ok';
    params.providerResult.cases.push({
      name: params.caseName,
      status: 'passed',
      detail,
      screenshotPath: null,
    });
    return true;
  } catch (error) {
    params.providerResult.cases.push({
      name: params.caseName,
      status: 'failed',
      detail: toFailureDetail(error),
      screenshotPath: await captureFailure(
        params.page,
        params.providerResult.provider,
        params.caseName,
        params.artifactDir
      ),
    });
    return false;
  }
}

async function runProviderCases(params: {
  artifactDir: string;
  baseUrl: string;
  callbackPath: string;
  page: Page;
  providerResult: OAuthProviderResult;
  recorder: ReturnType<typeof createAuthResponseRecorder>;
  cdpSession: Awaited<
    ReturnType<typeof createAuthBrowserHarness>
  >['cdpSession'];
  context: Awaited<ReturnType<typeof createAuthBrowserHarness>>['context'];
}) {
  const {
    artifactDir,
    baseUrl,
    callbackPath,
    page,
    providerResult,
    recorder,
    cdpSession,
    context,
  } = params;

  const successPassed = await recordCase({
    page,
    providerResult,
    caseName: 'callback_success',
    artifactDir,
    action: async () => {
      await context.clearCookies();
      recorder.start();
      const callbackResponsePromise: Promise<Response | Error> = page
        .waitForResponse((response) =>
          response.url().includes(createProviderPath(providerResult.provider))
        )
        .catch((error: unknown) =>
          error instanceof Error ? error : new Error(String(error))
        );

      const signInResult = await startProviderFlowFromSignIn({
        baseUrl,
        callbackPath,
        page,
        provider: providerResult.provider,
        onSignInResponse: async (signInResponse) => {
          await bridgeSessionCookieIfNeeded({
            page,
            context,
            cdpSession,
            baseUrl,
            response: signInResponse,
          });
        },
        handler: async (route, authRequestUrl) => {
          const state = authRequestUrl.searchParams.get('state');
          const redirectUri = authRequestUrl.searchParams.get('redirect_uri');
          assert(state, 'state 缺失');
          assert(redirectUri, 'redirect_uri 缺失');

          const callbackUrl = new URL(redirectUri);
          callbackUrl.searchParams.set(
            'code',
            `oauth-spike-${providerResult.provider}-success`
          );
          callbackUrl.searchParams.set('state', state);

          await route.fulfill({
            status: 302,
            headers: {
              location: callbackUrl.toString(),
            },
          });
        },
      });
      providerResult.authorizationUrl = signInResult.authorizationUrl;
      let inspected: ReturnType<typeof inspectAuthorizationUrl>;
      try {
        inspected = inspectAuthorizationUrl({
          authorizationUrl: signInResult.authorizationUrl,
          baseUrl,
          provider: providerResult.provider,
        });
      } catch (error) {
        throw new Error(
          `${toFailureDetail(error)} sign-in-response-url=${signInResult.responseUrl} sign-in-response-body=${signInResult.responseBody} auth-debug=${signInResult.originDebug}`
        );
      }
      providerResult.redirectUri = inspected.redirectUri;

      const callbackResponse = await callbackResponsePromise;
      if (callbackResponse instanceof Error) {
        throw callbackResponse;
      }
      providerResult.callbackSetCookieHeaders =
        await getSetCookieHeaders(callbackResponse);
      providerResult.callbackResponseObservation =
        await summarizeResponse(callbackResponse);
      providerResult.contextCookiesBeforeBridge = await summarizeContextCookies(
        context,
        baseUrl
      );
      providerResult.protectedRequestBeforeBridge =
        await inspectProtectedRequest({
          callbackPath,
          context,
          baseUrl,
        });
      await bridgeSessionCookieIfNeeded({
        page,
        context,
        cdpSession,
        baseUrl,
        response: callbackResponse,
      });
      providerResult.contextCookiesAfterBridge = await summarizeContextCookies(
        context,
        baseUrl
      );
      providerResult.protectedRequestAfterBridge =
        await inspectProtectedRequest({
          callbackPath,
          context,
          baseUrl,
        });
      await ensureProtectedPageNavigation(page, baseUrl, callbackPath);
      providerResult.sessionObservationAfterCallback =
        await getSessionViaAuthApi(context, baseUrl);

      providerResult.callbackResponses = await recorder.stop();
      providerResult.finalUrlAfterSuccess = stripOrigin(page.url());
      const finalSuccessUrl = new URL(page.url());

      assert.equal(
        providerResult.callbackResponses.some((response) =>
          response.url.includes(createProviderPath(providerResult.provider))
        ),
        true,
        `[${providerResult.provider}] 必须命中 OAuth callback`
      );
      assert.equal(
        hasNoStoreHeader(providerResult.callbackResponses),
        true,
        `[${providerResult.provider}] OAuth callback auth 响应必须带 no-store`
      );
      assert.equal(
        hasSecureCookieFlags(providerResult.callbackResponses),
        true,
        `[${providerResult.provider}] OAuth callback auth 响应必须包含完整 cookie 安全属性`
      );
      assert(providerResult.sessionObservationAfterCallback);
      assertSignedInSession(
        providerResult.sessionObservationAfterCallback,
        `[${providerResult.provider}] OAuth callback 后 session 应可通过同源 auth API 读取`
      );
      assert.equal(
        stripOrigin(finalSuccessUrl.toString()).startsWith(callbackPath),
        true,
        `[${providerResult.provider}] secure cookie bridge 之后浏览器必须能到达 callback 目标页`
      );
      assert(providerResult.protectedRequestAfterBridge);
      assert.equal(
        providerResult.protectedRequestAfterBridge.status,
        200,
        `[${providerResult.provider}] callback 目标页必须可同源访问`
      );
      assert.equal(
        providerResult.protectedRequestAfterBridge.location,
        null,
        `[${providerResult.provider}] callback 目标页不得跨 origin 重定向`
      );

      return 'session established and callback target became reachable after secure-cookie bridge';
    },
  });

  if (!successPassed) {
    return;
  }

  const sessionReadPassed = await recordCase({
    page,
    providerResult,
    caseName: 'session_read_happy_path',
    artifactDir,
    action: async () => {
      const observation = await getSessionViaAuthApi(context, baseUrl);
      assertSignedInSession(
        observation,
        `[${providerResult.provider}] session_read_happy_path 应持续返回已登录 session`
      );

      return 'session remains readable via /api/auth/get-session';
    },
  });

  if (!sessionReadPassed) {
    return;
  }

  const signOutPassed = await recordCase({
    page,
    providerResult,
    caseName: 'sign_out',
    artifactDir,
    action: async () => {
      providerResult.signOutResponseObservation = await signOutViaAuthApi(
        context,
        baseUrl
      );
      providerResult.signOutResponses = [
        providerResult.signOutResponseObservation,
      ];
      await bridgeClearedSessionCookieIfNeeded({
        context,
        cdpSession,
        baseUrl,
        responses: providerResult.signOutResponses,
      });
      providerResult.sessionObservationAfterSignOut =
        await getSessionViaAuthApi(context, baseUrl);

      assert.equal(
        hasNoStoreHeader(providerResult.signOutResponses),
        true,
        `[${providerResult.provider}] sign-out auth 响应必须带 no-store`
      );
      assert.equal(
        hasSecureCookieFlags(providerResult.signOutResponses),
        true,
        `[${providerResult.provider}] sign-out auth 响应必须包含完整 cookie 安全属性`
      );
      assert.equal(
        providerResult.signOutResponses.some(
          (response) => response.clearsCookie
        ),
        true,
        `[${providerResult.provider}] sign-out auth 响应必须清除 session cookie`
      );
      assert(providerResult.sessionObservationAfterSignOut);
      assertSignedOutSession(
        providerResult.sessionObservationAfterSignOut,
        `[${providerResult.provider}] sign-out 后 session 应被清除`
      );

      return 'signed out and confirmed via /api/auth/get-session';
    },
  });

  if (!signOutPassed) {
    return;
  }

  await recordCase({
    page,
    providerResult,
    caseName: 'provider_denied',
    artifactDir,
    action: async () => {
      await context.clearCookies();
      let callbackUrlToVisit: string | null = null;

      await startProviderFlowFromSignIn({
        baseUrl,
        callbackPath,
        page,
        provider: providerResult.provider,
        onSignInResponse: async (signInResponse) => {
          await bridgeSessionCookieIfNeeded({
            page,
            context,
            cdpSession,
            baseUrl,
            response: signInResponse,
          });
        },
        handler: async (route, authRequestUrl) => {
          const state = authRequestUrl.searchParams.get('state');
          const redirectUri = authRequestUrl.searchParams.get('redirect_uri');
          assert(state, 'state 缺失');
          assert(redirectUri, 'redirect_uri 缺失');

          const callbackUrl = new URL(redirectUri);
          callbackUrl.searchParams.set('error', 'access_denied');
          callbackUrl.searchParams.set(
            'error_description',
            'oauth_spike_denied'
          );
          callbackUrl.searchParams.set('state', state);
          callbackUrlToVisit = callbackUrl.toString();

          await route.fulfill({
            status: 204,
            body: '',
          });
        },
      });

      assert(
        callbackUrlToVisit,
        `[${providerResult.provider}] provider denied 必须生成 callback URL`
      );
      const errorPageUrl = await resolveOAuthFailureRedirect({
        callbackUrl: callbackUrlToVisit,
        context,
        provider: providerResult.provider,
      });
      await page.goto(errorPageUrl, {
        waitUntil: 'commit',
      });
      await waitForTerminalAuthErrorPage(page);
      providerResult.finalUrlAfterDenied = stripOrigin(page.url());

      assert.equal(
        isTerminalAuthErrorUrl(providerResult.finalUrlAfterDenied),
        true,
        `[${providerResult.provider}] provider denied 必须最终回到 sign-in 错误页`
      );
      assert.match(
        providerResult.finalUrlAfterDenied,
        /^\/(?:\?|\S*\?)(.+&)?error=access_denied(&|$)/,
        `[${providerResult.provider}] provider denied 必须携带显式错误参数`
      );

      const sessionAfterDenied = await getSessionViaAuthApi(context, baseUrl);
      assertSignedOutSession(
        sessionAfterDenied,
        `[${providerResult.provider}] provider denied 后不应建立 session`
      );

      return `redirected to ${providerResult.finalUrlAfterDenied} without session`;
    },
  });

  await recordCase({
    page,
    providerResult,
    caseName: 'state_tamper',
    artifactDir,
    action: async () => {
      await context.clearCookies();
      let callbackUrlToVisit: string | null = null;

      await startProviderFlowFromSignIn({
        baseUrl,
        callbackPath,
        page,
        provider: providerResult.provider,
        onSignInResponse: async (signInResponse) => {
          await bridgeSessionCookieIfNeeded({
            page,
            context,
            cdpSession,
            baseUrl,
            response: signInResponse,
          });
        },
        handler: async (route, authRequestUrl) => {
          const state = authRequestUrl.searchParams.get('state');
          const redirectUri = authRequestUrl.searchParams.get('redirect_uri');
          assert(state, 'state 缺失');
          assert(redirectUri, 'redirect_uri 缺失');

          const callbackUrl = new URL(redirectUri);
          callbackUrl.searchParams.set(
            'code',
            `oauth-spike-${providerResult.provider}-tamper`
          );
          callbackUrl.searchParams.set('state', `tampered-${state}`);
          callbackUrlToVisit = callbackUrl.toString();

          await route.fulfill({
            status: 204,
            body: '',
          });
        },
      });

      assert(
        callbackUrlToVisit,
        `[${providerResult.provider}] tampered state 必须生成 callback URL`
      );
      const errorPageUrl = await resolveOAuthFailureRedirect({
        callbackUrl: callbackUrlToVisit,
        context,
        provider: providerResult.provider,
      });
      await page.goto(errorPageUrl, {
        waitUntil: 'commit',
      });
      await waitForTerminalAuthErrorPage(page);
      providerResult.finalUrlAfterStateTamper = stripOrigin(page.url());

      assert.equal(
        isTerminalAuthErrorUrl(providerResult.finalUrlAfterStateTamper),
        true,
        `[${providerResult.provider}] tampered state 必须最终回到终态错误页`
      );
      assert.match(
        providerResult.finalUrlAfterStateTamper,
        /^\/(?:\?|\S*\?)(.+&)?error=(please_restart_the_process|state_mismatch)(&|$)/,
        `[${providerResult.provider}] tampered state 必须携带显式错误参数`
      );

      const sessionAfterTamper = await getSessionViaAuthApi(context, baseUrl);
      assertSignedOutSession(
        sessionAfterTamper,
        `[${providerResult.provider}] tampered state 后不应建立 session`
      );

      return `redirected to ${providerResult.finalUrlAfterStateTamper} without session`;
    },
  });
}

export async function runCloudflareOAuthSpike(params: {
  artifactDir: string;
  baseUrl: string;
  callbackPath: string;
}) {
  const harness = await createAuthBrowserHarness();
  const recorder = createAuthResponseRecorder(harness.page);
  const preflight: PreflightCheck[] = [];
  const providers: OAuthProviderResult[] = [];

  try {
    for (const provider of PROVIDERS) {
      const providerResult = createOAuthProviderResult(provider.id);
      providers.push(providerResult);

      try {
        await openSignInAndWaitForSocialProviderButton({
          baseUrl: params.baseUrl,
          callbackPath: params.callbackPath,
          page: harness.page,
          buttonTestId: provider.buttonTestId,
        });
        preflight.push({
          name: `${provider.id}-button`,
          status: 'passed',
          detail: `${provider.buttonTestId} visible on sign-in`,
          surface: 'cloudflare',
        });
      } catch (error) {
        preflight.push({
          name: `${provider.id}-button`,
          status: 'failed',
          detail: toFailureDetail(error),
          surface: 'cloudflare',
        });
        continue;
      }

      await runProviderCases({
        artifactDir: params.artifactDir,
        baseUrl: params.baseUrl,
        callbackPath: params.callbackPath,
        page: harness.page,
        providerResult,
        recorder,
        cdpSession: harness.cdpSession,
        context: harness.context,
      });
      summarizeOAuthFailureKinds(providerResult);
    }
  } finally {
    recorder.dispose();
    await closeAuthBrowserHarness(harness);
  }

  return {
    preflight,
    providers,
  };
}
