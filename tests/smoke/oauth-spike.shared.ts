import {
  type BrowserContextCookieSummary,
  type CaseStatus,
  type HarnessStatus,
  type PreflightCheck,
  type RawConclusion,
  type ResponseSummary,
  type SessionObservation,
} from './auth-spike.shared';

export type OAuthProviderName = 'google' | 'github';

export type OAuthFailureKind =
  | 'core_flow_unavailable'
  | 'failure_path_mismatch';

export type OAuthCaseName =
  | 'callback_success'
  | 'session_read_happy_path'
  | 'sign_out'
  | 'provider_denied'
  | 'state_tamper';

export type OAuthCaseResult = {
  name: OAuthCaseName;
  status: CaseStatus;
  detail: string;
  screenshotPath: string | null;
};

export type ProtectedRequestObservation = {
  url: string;
  status: number;
  location: string | null;
  bodySnippet: string;
};

export type OAuthProviderResult = {
  provider: OAuthProviderName;
  authorizationUrl: string | null;
  redirectUri: string | null;
  cases: OAuthCaseResult[];
  callbackResponses: ResponseSummary[];
  signOutResponses: ResponseSummary[];
  callbackResponseObservation: ResponseSummary | null;
  callbackSetCookieHeaders: string[];
  contextCookiesBeforeBridge: BrowserContextCookieSummary[];
  contextCookiesAfterBridge: BrowserContextCookieSummary[];
  sessionObservationAfterCallback: SessionObservation | null;
  sessionObservationAfterSignOut: SessionObservation | null;
  signOutResponseObservation: ResponseSummary | null;
  protectedRequestBeforeBridge: ProtectedRequestObservation | null;
  protectedRequestAfterBridge: ProtectedRequestObservation | null;
  finalUrlAfterSuccess: string | null;
  finalUrlAfterDenied: string | null;
  finalUrlAfterStateTamper: string | null;
  failureKinds: OAuthFailureKind[];
};

export type OAuthSpikeReport = {
  generatedAt: string;
  commitSha: string;
  callbackPath: string;
  runId: string;
  preflight: PreflightCheck[];
  providers: OAuthProviderResult[];
  rawConclusion: RawConclusion;
  harnessStatus: HarnessStatus;
  failureSummary: string[];
};

export function createEmptyOAuthSpikeReport({
  callbackPath,
  commitSha,
  runId,
}: {
  callbackPath: string;
  commitSha: string;
  runId: string;
}): OAuthSpikeReport {
  return {
    generatedAt: new Date().toISOString(),
    commitSha,
    callbackPath,
    runId,
    preflight: [],
    providers: [],
    rawConclusion: 'BLOCKED',
    harnessStatus: 'FAIL',
    failureSummary: [],
  };
}

export function createOAuthProviderResult(
  provider: OAuthProviderName
): OAuthProviderResult {
  return {
    provider,
    authorizationUrl: null,
    redirectUri: null,
    cases: [],
    callbackResponses: [],
    signOutResponses: [],
    callbackResponseObservation: null,
    callbackSetCookieHeaders: [],
    contextCookiesBeforeBridge: [],
    contextCookiesAfterBridge: [],
    sessionObservationAfterCallback: null,
    sessionObservationAfterSignOut: null,
    signOutResponseObservation: null,
    protectedRequestBeforeBridge: null,
    protectedRequestAfterBridge: null,
    finalUrlAfterSuccess: null,
    finalUrlAfterDenied: null,
    finalUrlAfterStateTamper: null,
    failureKinds: [],
  };
}

function pushFailureKind(
  provider: OAuthProviderResult,
  failureKind: OAuthFailureKind
) {
  if (!provider.failureKinds.includes(failureKind)) {
    provider.failureKinds.push(failureKind);
  }
}

export function summarizeOAuthFailureKinds(provider: OAuthProviderResult) {
  const failedCases = provider.cases.filter((item) => item.status === 'failed');

  if (
    failedCases.some((item) =>
      ['callback_success', 'session_read_happy_path', 'sign_out'].includes(
        item.name
      )
    )
  ) {
    pushFailureKind(provider, 'core_flow_unavailable');
  }

  if (
    failedCases.some((item) =>
      ['provider_denied', 'state_tamper'].includes(item.name)
    )
  ) {
    pushFailureKind(provider, 'failure_path_mismatch');
  }
}

export function deriveOAuthSpikeConclusion(report: OAuthSpikeReport): {
  rawConclusion: RawConclusion;
  harnessStatus: HarnessStatus;
  failureSummary: string[];
} {
  const failureSummary: string[] = [];
  const preflightFailures = report.preflight
    .filter((check) => check.status === 'failed')
    .map((check) => `preflight:${check.surface}:${check.name}:${check.detail}`);
  const caseFailures = report.providers.flatMap((provider) =>
    provider.cases
      .filter((item) => item.status === 'failed')
      .map((item) => `${provider.provider}:${item.name}:${item.detail}`)
  );

  failureSummary.push(...preflightFailures, ...caseFailures);

  if (preflightFailures.length > 0) {
    return {
      rawConclusion: 'BLOCKED',
      harnessStatus: 'FAIL',
      failureSummary,
    };
  }

  if (caseFailures.length === 0) {
    return {
      rawConclusion: 'PASS',
      harnessStatus: 'PASS',
      failureSummary,
    };
  }

  const anyCoreFailure = report.providers.some((provider) =>
    provider.failureKinds.includes('core_flow_unavailable')
  );

  return {
    rawConclusion: anyCoreFailure ? '需要替代路线' : '需要 adapter',
    harnessStatus: 'FAIL',
    failureSummary,
  };
}
