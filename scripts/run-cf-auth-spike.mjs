import '@/config/load-dotenv';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as authSpikeBrowserModule from '../src/testing/auth-spike.browser.ts';
import * as authSpikeSharedModule from '../src/testing/auth-spike.shared.ts';
import {
  renderCloudflareLocalTopologyLogs,
  resolveCloudflareLocalDatabaseUrl,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';
import {
  normalizePreviewBaseUrl,
  resolveAuthSecret,
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

const authSpikeShared = authSpikeSharedModule.default ?? authSpikeSharedModule;
const authSpikeBrowser =
  authSpikeBrowserModule.default ?? authSpikeBrowserModule;

injectCloudflareLocalSmokeDevVars();

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const timestamp = createTimestamp();
const reportPaths = createReportArtifacts({
  rootDir,
  timestamp,
  reportPrefix: 'cf-auth-spike-report',
  artifactSubdir: 'cf-auth-spike',
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

function renderMarkdown(report) {
  const surface = report.surfaces[0];
  const caseRows = surface?.cases
    ?.map(
      (item) =>
        `| ${item.name} | ${item.status} | ${String(item.detail).replace(/\|/g, '\\|').replace(/\n/g, '<br>')} | ${item.screenshotPath || '-'} |`
    )
    .join('\n');
  const preflightRows = report.preflight
    ?.map(
      (check) =>
        `| ${check.surface} | ${check.name} | ${check.status} | ${String(check.detail).replace(/\|/g, '\\|').replace(/\n/g, '<br>')} |`
    )
    .join('\n');

  return `# Cloudflare Preview Auth Spike Report

- Generated at: ${report.generatedAt}
- Commit SHA: ${report.commitSha}
- Run ID: ${report.runId}
- Callback path: ${report.callbackPath}
- Harness status: ${report.harnessStatus}
- Raw conclusion: ${report.rawConclusion}
- Cloudflare URL: ${surface?.url || 'n/a'}
- Email used: ${surface?.emailUsed || 'n/a'}

## Preflight

| Surface | Check | Status | Detail |
| --- | --- | --- | --- |
${preflightRows || '| - | - | - | no preflight checks |'}

## Case Results

| Case | Status | Detail | Screenshot |
| --- | --- | --- | --- |
${caseRows || '| - | - | no cases | - |'}

## Failure Summary

${report.failureSummary?.length ? report.failureSummary.map((item) => `- ${item}`).join('\n') : '- none'}

## Auth Responses

${renderResponseSummary('sign-up auth responses', surface?.signUpResponses)}
${surface ? '\n' : ''}${renderResponseSummary('sign-in auth responses', surface?.signInResponses)}
${surface ? '\n' : ''}${renderResponseSummary('sign-out auth responses', surface?.signOutResponses)}
`;
}

async function writeReports(report) {
  await writeReportArtifacts({
    paths: reportPaths,
    report,
    renderMarkdown,
  });
}

async function main() {
  const requestedBaseUrl = normalizePreviewBaseUrl(
    process.env.CF_AUTH_SPIKE_URL || process.env.CF_LOCAL_SMOKE_URL
  );
  const callbackPath = normalizeCallbackPath(
    process.env.CF_AUTH_SPIKE_CALLBACK_PATH ||
      process.env.AUTH_SPIKE_CALLBACK_PATH
  );
  const runId = process.env.CF_AUTH_SPIKE_RUN_ID?.trim() || timestamp;
  const baseEmail =
    process.env.CF_AUTH_SPIKE_EMAIL?.trim() ||
    process.env.AUTH_SPIKE_EMAIL?.trim() ||
    'auth-spike@example.com';
  const password =
    process.env.CF_AUTH_SPIKE_PASSWORD?.trim() ||
    process.env.AUTH_SPIKE_PASSWORD?.trim() ||
    'AuthSpike123!auth';
  const userName =
    process.env.CF_AUTH_SPIKE_USER_NAME?.trim() ||
    process.env.AUTH_SPIKE_USER_NAME?.trim() ||
    'Auth Spike User';
  const emails = authSpikeShared.buildSurfaceRunEmails(baseEmail, runId);
  const emailUsed = emails.cloudflare;
  const reuseServer = process.env.CF_LOCAL_SMOKE_REUSE_SERVER === 'true';
  const wranglerConfigPath =
    process.env.CF_LOCAL_SMOKE_WRANGLER_CONFIG_PATH?.trim() ||
    path.resolve(rootDir, resolveSiteDeployContract({ rootDir }).router.wranglerConfigRelativePath);
  const databaseUrl = await resolveCloudflareLocalDatabaseUrl({
    processEnv: process.env,
    wranglerConfigPath,
  });
  const authSecret = resolveAuthSecret();

  const report = authSpikeShared.createEmptyReport({
    callbackPath,
    commitSha: readCommitShaSafely(),
    emails,
    runId,
  });

  const topology = reuseServer
    ? null
    : await startCloudflareLocalDevTopology({
        databaseUrl,
        routerTemplatePath: wranglerConfigPath,
        routerBaseUrl: requestedBaseUrl,
        authSecret,
      });
  const baseUrl = topology ? topology.getRouterBaseUrl() : requestedBaseUrl;

  try {
    if (topology) {
      await waitForPreviewReady({ baseUrl });
    }

    await runCloudflarePreviewSmoke({ baseUrl });
    report.preflight.push({
      name: 'cf-preview-db-smoke',
      status: 'passed',
      detail: 'config-api/sign-up/sign-in repeated requests passed',
      surface: 'cloudflare',
    });

    report.surfaces.push(
      await authSpikeBrowser.runAuthSurface({
        surfaceName: 'cloudflare',
        baseUrl,
        emailUsed,
        password,
        callbackPath,
        userName,
        artifactDir: reportPaths.artifactDir,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.failureSummary.push(`fatal:${message}`);
    const recentLogs = renderCloudflareLocalTopologyLogs(topology);
    if (recentLogs) {
      process.stderr.write(`${recentLogs}\n`);
    }
    throw error;
  } finally {
    const conclusion = authSpikeShared.deriveConclusion(report);
    report.rawConclusion = conclusion.rawConclusion;
    report.harnessStatus = conclusion.harnessStatus;
    report.failureSummary = Array.from(
      new Set([...report.failureSummary, ...conclusion.failureSummary])
    );
    await writeReports(report);

    await topology?.stop();
  }

  process.stdout.write(
    `${formatHarnessSummaryLines({
      label: 'cf-auth-spike',
      rootDir,
      reportMarkdownPath: reportPaths.reportMarkdownPath,
      report,
      extras: [`[cf-auth-spike] email: ${emailUsed}`],
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
