import assert from 'node:assert/strict';

import { compareRuntimeResponseContracts } from './runtime-parity';

export const AUTH_SPIKE_REQUIRED_ENV_NAMES = [
  'AUTH_SPIKE_VERCEL_URL',
  'AUTH_SPIKE_CF_URL',
  'AUTH_SPIKE_EMAIL',
  'AUTH_SPIKE_PASSWORD',
  'AUTH_SPIKE_CALLBACK_PATH',
] as const;

export type SurfaceName = 'vercel' | 'cloudflare';
export type RawConclusion =
  | 'PASS'
  | 'BLOCKED'
  | '需要 adapter'
  | '需要替代路线';
export type HarnessStatus = 'PASS' | 'FAIL';
export type CaseStatus = 'passed' | 'failed';
export type FailureKind =
  | 'auth_flow_unavailable'
  | 'callback_mismatch'
  | 'invalid_cookie_behavior'
  | 'sign_out_behavior'
  | 'parity_mismatch';

export type PreflightCheck = {
  name: string;
  status: CaseStatus;
  detail: string;
  surface: SurfaceName | 'global';
};

export type ResponseSummary = {
  url: string;
  status: number;
  cacheControl: string | null;
  contentType: string | null;
  location: string | null;
  headers: Record<string, string>;
  setCookieHeaderCount: number;
  cookies: ResponseCookieSummary[];
  setCookiePresent: boolean;
  clearsCookie: boolean;
};

export type ResponseCookieSummary = {
  name: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | null;
  clearsCookie: boolean;
};

export type BrowserContextCookieSummary = {
  name: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | null;
  expires: number | null;
};

export type SessionObservation = {
  url: string;
  status: number;
  headers: Record<string, string>;
  bodySnippet: string;
  sessionPresent: boolean;
  userPresent: boolean;
};

export type CaseResult = {
  name: string;
  status: CaseStatus;
  detail: string;
  screenshotPath: string | null;
};

export type SurfaceResult = {
  surface: SurfaceName;
  url: string;
  emailUsed: string;
  cases: CaseResult[];
  signUpResponses: ResponseSummary[];
  signInResponses: ResponseSummary[];
  signOutResponses: ResponseSummary[];
  sessionAfterSignUp: SessionObservation | null;
  sessionAfterSignIn: SessionObservation | null;
  sessionAfterSignOut: SessionObservation | null;
  finalUrlAfterSignUp: string | null;
  finalUrlAfterSignIn: string | null;
  finalUrlAfterInvalidCookie: string | null;
  finalUrlAfterSignOut: string | null;
  failureKinds: FailureKind[];
};

export type ParityResult = {
  status: CaseStatus;
  detail: string;
};

export type Report = {
  generatedAt: string;
  commitSha: string;
  callbackPath: string;
  runId: string;
  emails: Record<SurfaceName, string>;
  preflight: PreflightCheck[];
  surfaces: SurfaceResult[];
  parity: ParityResult | null;
  rawConclusion: RawConclusion;
  harnessStatus: HarnessStatus;
  failureSummary: string[];
};

export function normalizeCallbackPath(pathname: string): string {
  if (!pathname) {
    return '/settings/profile';
  }

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(pathname)) {
    throw new Error(
      'AUTH_SPIKE_CALLBACK_PATH 必须是同源路径，不能是带协议的绝对 URL'
    );
  }

  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function buildSurfaceRunEmails(
  baseEmail: string,
  runId: string
): Record<SurfaceName, string> {
  const trimmed = baseEmail.trim();
  const atIndex = trimmed.lastIndexOf('@');

  assert(
    atIndex > 0 && atIndex < trimmed.length - 1,
    'AUTH_SPIKE_EMAIL 必须是有效邮箱'
  );

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);
  const safeRunId = runId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  return {
    vercel: `${localPart}+vercel-${safeRunId}@${domainPart}`,
    cloudflare: `${localPart}+cloudflare-${safeRunId}@${domainPart}`,
  };
}

export function hasNoStoreHeader(responses: ResponseSummary[]): boolean {
  return responses.some((response) =>
    response.cacheControl?.toLowerCase().includes('no-store')
  );
}

export function hasSecureCookieFlags(responses: ResponseSummary[]): boolean {
  const shouldRequireSecure = (urlValue: string): boolean => {
    try {
      const url = new URL(urlValue);
      const isLocalHttp =
        url.protocol === 'http:' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
      return !isLocalHttp;
    } catch {
      return true;
    }
  };

  return responses.some(
    (response) =>
      response.setCookiePresent &&
      response.cookies.length > 0 &&
      response.cookies.every(
        (cookie) =>
          cookie.httpOnly &&
          cookie.sameSite !== null &&
          (cookie.secure || !shouldRequireSecure(response.url))
      )
  );
}

export function createEmptyReport({
  callbackPath,
  commitSha,
  emails,
  runId,
}: {
  callbackPath: string;
  commitSha: string;
  emails: Record<SurfaceName, string>;
  runId: string;
}): Report {
  return {
    generatedAt: new Date().toISOString(),
    commitSha,
    callbackPath,
    runId,
    emails,
    preflight: [],
    surfaces: [],
    parity: null,
    rawConclusion: 'BLOCKED',
    harnessStatus: 'FAIL',
    failureSummary: [],
  };
}

export function createSurfaceResult(
  surface: SurfaceName,
  url: string,
  emailUsed: string
): SurfaceResult {
  return {
    surface,
    url,
    emailUsed,
    cases: [],
    signUpResponses: [],
    signInResponses: [],
    signOutResponses: [],
    sessionAfterSignUp: null,
    sessionAfterSignIn: null,
    sessionAfterSignOut: null,
    finalUrlAfterSignUp: null,
    finalUrlAfterSignIn: null,
    finalUrlAfterInvalidCookie: null,
    finalUrlAfterSignOut: null,
    failureKinds: [],
  };
}

function pushFailureKind(surface: SurfaceResult, failureKind: FailureKind) {
  if (!surface.failureKinds.includes(failureKind)) {
    surface.failureKinds.push(failureKind);
  }
}

export function summarizeFailureKinds(surface: SurfaceResult) {
  const failedCases = surface.cases.filter((item) => item.status === 'failed');

  if (
    failedCases.some((item) => ['sign-up', 'sign-in'].includes(item.name))
  ) {
    pushFailureKind(surface, 'auth_flow_unavailable');
  }

  if (failedCases.some((item) => item.name === 'callback-url')) {
    pushFailureKind(surface, 'callback_mismatch');
  }

  if (failedCases.some((item) => item.name === 'invalid-cookie')) {
    pushFailureKind(surface, 'invalid_cookie_behavior');
  }

  if (failedCases.some((item) => item.name === 'sign-out')) {
    pushFailureKind(surface, 'sign_out_behavior');
  }
}

export function deriveParityResult(report: Report): ParityResult | null {
  if (report.surfaces.length < 2) {
    return null;
  }

  const vercel = report.surfaces.find((surface) => surface.surface === 'vercel');
  const cloudflare = report.surfaces.find(
    (surface) => surface.surface === 'cloudflare'
  );

  if (!vercel || !cloudflare) {
    return null;
  }

  const parityChecks = [
    compareRuntimeResponseContracts({
      label: 'sign-up auth response',
      baselineName: 'vercel',
      candidateName: 'cloudflare',
      baselineResponses: vercel.signUpResponses,
      candidateResponses: cloudflare.signUpResponses,
    }),
    compareRuntimeResponseContracts({
      label: 'sign-in auth response',
      baselineName: 'vercel',
      candidateName: 'cloudflare',
      baselineResponses: vercel.signInResponses,
      candidateResponses: cloudflare.signInResponses,
    }),
    compareRuntimeResponseContracts({
      label: 'sign-out auth response',
      baselineName: 'vercel',
      candidateName: 'cloudflare',
      baselineResponses: vercel.signOutResponses,
      candidateResponses: cloudflare.signOutResponses,
    }),
  ];

  const failedChecks = parityChecks.filter((check) => check.status === 'failed');
  if (failedChecks.length === 0) {
    return {
      status: 'passed',
      detail: 'runtime contracts matched',
    };
  }

  return {
    status: 'failed',
    detail: failedChecks.map((check) => check.detail).join('; '),
  };
}

export function deriveConclusion(report: Report): {
  rawConclusion: RawConclusion;
  harnessStatus: HarnessStatus;
  failureSummary: string[];
} {
  const failureSummary: string[] = [];
  const preflightFailures = report.preflight
    .filter((check) => check.status === 'failed')
    .map((check) => `preflight:${check.surface}:${check.name}:${check.detail}`);
  const caseFailures = report.surfaces.flatMap((surface) =>
    surface.cases
      .filter((item) => item.status === 'failed')
      .map((item) => `${surface.surface}:${item.name}:${item.detail}`)
  );

  failureSummary.push(...preflightFailures, ...caseFailures);

  if (report.parity?.status === 'failed') {
    failureSummary.push(`parity:${report.parity.detail}`);
  }

  if (preflightFailures.length > 0) {
    return {
      rawConclusion: 'BLOCKED',
      harnessStatus: 'FAIL',
      failureSummary,
    };
  }

  if (
    caseFailures.length === 0 &&
    (!report.parity || report.parity.status === 'passed')
  ) {
    return {
      rawConclusion: 'PASS',
      harnessStatus: 'PASS',
      failureSummary,
    };
  }

  const anyAuthFlowUnavailable = report.surfaces.some((surface) =>
    surface.failureKinds.includes('auth_flow_unavailable')
  );

  return {
    rawConclusion: anyAuthFlowUnavailable ? '需要替代路线' : '需要 adapter',
    harnessStatus: 'FAIL',
    failureSummary,
  };
}
