import '@/config/load-dotenv';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as oauthSpikeBrowserModule from '../src/testing/oauth-spike.browser.ts';
import * as oauthSpikeSharedModule from '../src/testing/oauth-spike.shared.ts';
import * as oauthSpikeReportModule from './lib/cf-oauth-spike-report.ts';
import * as oauthSpikeScriptModule from './lib/cf-oauth-spike.ts';
import {
  renderCloudflareLocalTopologyLogs,
  resolveCloudflareLocalDatabaseUrl,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';
import {
  resolveAuthSecret,
  resolveConfiguredPreviewBaseUrl,
  runCloudflarePreviewSmoke,
  waitForPreviewReady,
} from './lib/cloudflare-preview-smoke.mjs';
import {
  createReportArtifacts,
  formatHarnessSummaryLines,
  writeReportArtifacts,
} from './lib/harness/reporter.mjs';
import {
  createTimestamp,
  readCommitShaSafely,
} from './lib/harness/runtime.mjs';
import { injectCloudflareLocalSmokeDevVars } from './run-cf-local-smoke.mjs';

const oauthSpikeShared =
  oauthSpikeSharedModule.default ?? oauthSpikeSharedModule;
const oauthSpikeBrowser =
  oauthSpikeBrowserModule.default ?? oauthSpikeBrowserModule;
const oauthSpikeScript =
  oauthSpikeScriptModule.default ?? oauthSpikeScriptModule;
const oauthSpikeReport =
  oauthSpikeReportModule.default ?? oauthSpikeReportModule;

injectCloudflareLocalSmokeDevVars();

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const timestamp = createTimestamp();
const reportPaths = createReportArtifacts({
  rootDir,
  timestamp,
  reportPrefix: 'cf-oauth-spike-report',
  artifactSubdir: 'cf-oauth-spike',
});

function normalizeCallbackPath(pathname) {
  const raw = pathname?.trim() || '/settings/profile';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function renderResponseSummary(title, responses) {
  if (!responses?.length) {
    return `- ${title}: none`;
  }

  const formatCookies = (response) =>
    response.cookies?.length
      ? response.cookies
          .map(
            (cookie) =>
              `${cookie.name}{clear=${cookie.clearsCookie ? 'yes' : 'no'},httpOnly=${cookie.httpOnly ? 'yes' : 'no'},secure=${cookie.secure ? 'yes' : 'no'},sameSite=${cookie.sameSite || 'none'}}`
          )
          .join(', ')
      : 'none';

  return [
    `- ${title}:`,
    ...responses.map(
      (response) =>
        `  - ${response.status} ${response.url} cache-control=${response.cacheControl || 'n/a'} content-type=${response.contentType || 'n/a'} set-cookie=${response.setCookiePresent ? 'yes' : 'no'} set-cookie-count=${response.setCookieHeaderCount || 0} clear-cookie=${response.clearsCookie ? 'yes' : 'no'} cookies=${formatCookies(response)}`
    ),
  ].join('\n');
}

function renderStringList(title, values) {
  if (!values?.length) {
    return `- ${title}: none`;
  }

  return [`- ${title}:`, ...values.map((value) => `  - ${value}`)].join('\n');
}

function renderBrowserContextCookies(title, cookies) {
  if (!cookies?.length) {
    return `- ${title}: none`;
  }

  return [
    `- ${title}:`,
    ...cookies.map(
      (cookie) =>
        `  - ${cookie.name} domain=${cookie.domain} path=${cookie.path} httpOnly=${cookie.httpOnly ? 'yes' : 'no'} secure=${cookie.secure ? 'yes' : 'no'} sameSite=${cookie.sameSite || 'none'} expires=${cookie.expires ?? 'session'}`
    ),
  ].join('\n');
}

function renderProtectedRequestObservation(title, observation) {
  if (!observation) {
    return `- ${title}: none`;
  }

  return `- ${title}: ${observation.status} ${observation.url} location=${observation.location || 'n/a'} body=${observation.bodySnippet || 'n/a'}`;
}

function renderSessionObservation(title, observation) {
  if (!observation) {
    return `- ${title}: none`;
  }

  return `- ${title}: ${observation.status} ${observation.url} session=${observation.sessionPresent ? 'present' : 'missing'} user=${observation.userPresent ? 'present' : 'missing'} body=${observation.bodySnippet || 'n/a'}`;
}

function renderMarkdown(report, baseUrl) {
  const preflightRows = report.preflight
    .map(
      (check) =>
        `| ${check.surface} | ${check.name} | ${check.status} | ${String(check.detail).replace(/\|/g, '\\|').replace(/\n/g, '<br>')} |`
    )
    .join('\n');

  const providerSections = report.providers
    .map((provider) => {
      const caseRows = provider.cases
        .map(
          (item) =>
            `| ${item.name} | ${item.status} | ${String(item.detail).replace(/\|/g, '\\|').replace(/\n/g, '<br>')} | ${item.screenshotPath || '-'} |`
        )
        .join('\n');

      return `## ${provider.provider}

- Authorization URL: ${provider.authorizationUrl || 'n/a'}
- Redirect URI: ${provider.redirectUri || 'n/a'}
- Success final URL (after secure-cookie bridge): ${provider.finalUrlAfterSuccess || 'n/a'}
- Denied final URL: ${provider.finalUrlAfterDenied || 'n/a'}
- State tamper final URL: ${provider.finalUrlAfterStateTamper || 'n/a'}

| Case | Status | Detail | Screenshot |
| --- | --- | --- | --- |
${caseRows || '| - | - | no cases | - |'}

${renderResponseSummary('callback response observation', provider.callbackResponseObservation ? [provider.callbackResponseObservation] : [])}
${provider.callbackResponseObservation ? '\n' : ''}${renderStringList('callback raw Set-Cookie', provider.callbackSetCookieHeaders)}
${provider.callbackSetCookieHeaders.length ? '\n' : ''}${renderBrowserContextCookies('context cookies before bridge', provider.contextCookiesBeforeBridge)}
${provider.contextCookiesBeforeBridge.length ? '\n' : ''}${renderProtectedRequestObservation('manual protected request before bridge', provider.protectedRequestBeforeBridge)}
${provider.protectedRequestBeforeBridge ? '\n' : ''}${renderBrowserContextCookies('context cookies after bridge', provider.contextCookiesAfterBridge)}
${provider.contextCookiesAfterBridge.length ? '\n' : ''}${renderProtectedRequestObservation('manual protected request after bridge', provider.protectedRequestAfterBridge)}
${provider.protectedRequestAfterBridge ? '\n' : ''}${renderSessionObservation('session after callback', provider.sessionObservationAfterCallback)}
${provider.sessionObservationAfterCallback ? '\n' : ''}${renderResponseSummary('callback auth responses', provider.callbackResponses)}
${provider.callbackResponses.length ? '\n' : ''}${renderResponseSummary('sign-out response observation', provider.signOutResponseObservation ? [provider.signOutResponseObservation] : [])}
${provider.signOutResponseObservation ? '\n' : ''}${renderSessionObservation('session after sign-out', provider.sessionObservationAfterSignOut)}
${provider.callbackResponses.length ? '\n' : ''}${renderResponseSummary('sign-out auth responses', provider.signOutResponses)}
`;
    })
    .join('\n');

  return `# Cloudflare Preview OAuth Auth Spike Report

- Generated at: ${report.generatedAt}
- Commit SHA: ${report.commitSha}
- Run ID: ${report.runId}
- Callback path: ${report.callbackPath}
- Harness status: ${report.harnessStatus}
- Raw conclusion: ${report.rawConclusion}
- Cloudflare URL: ${baseUrl}

## Preflight

| Surface | Check | Status | Detail |
| --- | --- | --- | --- |
${preflightRows || '| - | - | - | no preflight checks |'}

## Failure Summary

${report.failureSummary?.length ? report.failureSummary.map((item) => `- ${item}`).join('\n') : '- none'}

${providerSections}
`;
}

async function writeReports(report, baseUrl) {
  await writeReportArtifacts({
    paths: reportPaths,
    report,
    renderMarkdown: (sanitizedReport) =>
      renderMarkdown(sanitizedReport, baseUrl),
    sanitizeReport: oauthSpikeReport.sanitizeOAuthSpikeReport,
  });
}

async function main() {
  const lock = await oauthSpikeScript.acquireCfOAuthSpikeLock();
  const fallbackBaseUrl = resolveConfiguredPreviewBaseUrl(
    process.env.CF_OAUTH_SPIKE_URL,
    process.env.CF_LOCAL_SMOKE_URL
  );
  const callbackPath = normalizeCallbackPath(
    process.env.CF_OAUTH_SPIKE_CALLBACK_PATH ||
      process.env.AUTH_SPIKE_CALLBACK_PATH
  );
  const runId = process.env.CF_OAUTH_SPIKE_RUN_ID?.trim() || timestamp;
  const wranglerConfigPath =
    process.env.CF_LOCAL_SMOKE_WRANGLER_CONFIG_PATH?.trim() ||
    path.resolve(rootDir, resolveSiteDeployContract({ rootDir }).router.wranglerConfigRelativePath);
  const databaseUrl = await resolveCloudflareLocalDatabaseUrl({
    processEnv: process.env,
    wranglerConfigPath,
  });
  let authSecret = '';
  let topology = null;
  let baseUrl = fallbackBaseUrl;
  let fatalError = null;

  const report = oauthSpikeShared.createEmptyOAuthSpikeReport({
    callbackPath,
    commitSha: readCommitShaSafely(),
    runId,
  });

  try {
    report.preflight.push({
      name: 'oauth-test-config-source',
      status: 'passed',
      detail:
        'AUTH_SPIKE_OAUTH_CONFIG_SEED=true injects in-memory Google/GitHub OAuth config, and AUTH_SPIKE_OAUTH_UPSTREAM_MOCK=true mocks only upstream OAuth exchanges, so this harness performs no local config-table writes',
      surface: 'cloudflare',
    });

    authSecret = resolveAuthSecret();
    topology = await startCloudflareLocalDevTopology({
      databaseUrl,
      routerTemplatePath: wranglerConfigPath,
      routerBaseUrl: fallbackBaseUrl,
      authSecret,
      extraVars: {
        AUTH_SPIKE_OAUTH_CONFIG_SEED: 'true',
        AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true',
      },
      processEnv: {
        ...process.env,
        AUTH_SPIKE_OAUTH_CONFIG_SEED: 'true',
        AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true',
      },
    });
    baseUrl = topology.getRouterBaseUrl();

    await waitForPreviewReady({ baseUrl });
    await runCloudflarePreviewSmoke({ baseUrl });
    report.preflight.push({
      name: 'cf-preview-db-smoke',
      status: 'passed',
      detail: 'config-api/sign-up/sign-in repeated requests passed',
      surface: 'cloudflare',
    });

    const browserResult = await oauthSpikeBrowser.runCloudflareOAuthSpike({
      baseUrl,
      callbackPath,
      artifactDir: reportPaths.artifactDir,
    });
    report.preflight.push(...browserResult.preflight);
    report.providers.push(...browserResult.providers);
  } catch (error) {
    fatalError = error;
    const message = error instanceof Error ? error.message : String(error);
    report.failureSummary.push(`fatal:${message}`);
  } finally {
    const cleanupFailures = [];

    try {
      await topology?.stop?.();
    } catch (error) {
      cleanupFailures.push(
        `cleanup:topology-stop:${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      await lock.release();
    } catch (error) {
      cleanupFailures.push(
        `cleanup:lock-release:${error instanceof Error ? error.message : String(error)}`
      );
    }

    const conclusion = oauthSpikeShared.deriveOAuthSpikeConclusion(report);
    const cleanupFailed = cleanupFailures.length > 0;
    const runFailed = cleanupFailed || fatalError !== null;
    report.rawConclusion = runFailed ? 'BLOCKED' : conclusion.rawConclusion;
    report.harnessStatus = runFailed ? 'FAIL' : conclusion.harnessStatus;
    report.failureSummary = Array.from(
      new Set([
        ...report.failureSummary,
        ...conclusion.failureSummary,
        ...cleanupFailures,
      ])
    );
    await writeReports(report, baseUrl);
  }

  if (fatalError) {
    const recentLogs = renderCloudflareLocalTopologyLogs(topology);
    if (recentLogs) {
      process.stderr.write(`${recentLogs}\n`);
    }
    process.stderr.write(
      `${fatalError instanceof Error ? fatalError.stack || fatalError.message : String(fatalError)}\n`
    );
  }

  process.stdout.write(
    `${formatHarnessSummaryLines({
      label: 'cf-oauth-spike',
      rootDir,
      reportMarkdownPath: reportPaths.reportMarkdownPath,
      report,
      extras: [`[cf-oauth-spike] cloudflare url: ${baseUrl}`],
    }).join('\n')}\n`
  );

  process.exit(report.harnessStatus === 'PASS' ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack || error.message : String(error)}\n`
  );
  process.exit(1);
});
