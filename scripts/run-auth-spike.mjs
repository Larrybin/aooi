import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as authSpikeSharedModule from '../tests/smoke/auth-spike.shared.ts';
import {
  createReportArtifacts,
  formatHarnessSummaryLines,
  resolveHarnessExitCode,
  writeReportArtifacts,
} from './lib/harness/reporter.mjs';
import {
  createTimestamp,
  readCommitShaSafely,
  sleep,
} from './lib/harness/runtime.mjs';

const authSpikeShared = authSpikeSharedModule.default ?? authSpikeSharedModule;

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const timestamp = createTimestamp();
const reportPaths = createReportArtifacts({
  rootDir,
  timestamp,
  reportPrefix: 'auth-spike-report',
  artifactSubdir: 'auth-spike',
});
const PREFLIGHT_CHECK_RETRY_ATTEMPTS = Number.parseInt(
  process.env.AUTH_SPIKE_PREFLIGHT_RETRY_ATTEMPTS || '8',
  10
);
const PREFLIGHT_CHECK_RETRY_DELAY_MS = Number.parseInt(
  process.env.AUTH_SPIKE_PREFLIGHT_RETRY_DELAY_MS || '1000',
  10
);

function getMissingEnvNames() {
  return authSpikeShared.AUTH_SPIKE_REQUIRED_ENV_NAMES.filter(
    (name) => !process.env[name]?.trim()
  );
}

function renderCaseRows(surface) {
  return surface.cases
    .map(
      (item) =>
        `| ${surface.surface} | ${item.name} | ${item.status} | ${escapeTable(item.detail)} | ${item.screenshotPath || '-'} |`
    )
    .join('\n');
}

function escapeTable(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
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

function renderSessionObservation(title, observation) {
  if (!observation) {
    return `- ${title}: none`;
  }

  return `- ${title}: ${observation.status} ${observation.url} session=${observation.sessionPresent ? 'present' : 'missing'} user=${observation.userPresent ? 'present' : 'missing'} body=${observation.bodySnippet || 'n/a'}`;
}

export function renderMarkdown(report) {
  const caseRows = report.surfaces
    .map(renderCaseRows)
    .filter(Boolean)
    .join('\n');
  const preflightRows = report.preflight
    ?.map(
      (check) =>
        `| ${check.surface} | ${check.name} | ${check.status} | ${escapeTable(check.detail)} |`
    )
    .join('\n');
  const responseBlocks = report.surfaces
    .map((surface) =>
      [
        `### ${surface.surface}`,
        `- URL: ${surface.url}`,
        `- Email used: ${surface.emailUsed || 'n/a'}`,
        `- sign-up final URL (diagnostic): ${surface.finalUrlAfterSignUp || 'n/a'}`,
        `- sign-in final URL (diagnostic): ${surface.finalUrlAfterSignIn || 'n/a'}`,
        `- invalid cookie final URL: ${surface.finalUrlAfterInvalidCookie || 'n/a'}`,
        `- sign-out final URL (diagnostic): ${surface.finalUrlAfterSignOut || 'n/a'}`,
        renderSessionObservation(
          'session after sign-up',
          surface.sessionAfterSignUp
        ),
        renderSessionObservation(
          'session after sign-in',
          surface.sessionAfterSignIn
        ),
        renderSessionObservation(
          'session after sign-out',
          surface.sessionAfterSignOut
        ),
        renderResponseSummary(
          'sign-up auth responses',
          surface.signUpResponses
        ),
        renderResponseSummary(
          'sign-in auth responses',
          surface.signInResponses
        ),
        renderResponseSummary(
          'sign-out auth responses',
          surface.signOutResponses
        ),
      ].join('\n')
    )
    .join('\n\n');

  return `# Auth Spike Feasibility Report

- Generated at: ${report.generatedAt}
- Commit SHA: ${report.commitSha}
- Run ID: ${report.runId}
- Callback path: ${report.callbackPath}
- Harness status: ${report.harnessStatus}
- Raw conclusion: ${report.rawConclusion}
- Vercel URL: ${report.surfaces.find((surface) => surface.surface === 'vercel')?.url || 'n/a'}
- Cloudflare URL: ${report.surfaces.find((surface) => surface.surface === 'cloudflare')?.url || 'n/a'}

## Surface Emails

- Vercel: ${report.emails?.vercel || 'n/a'}
- Cloudflare: ${report.emails?.cloudflare || 'n/a'}

## Preflight

| Surface | Check | Status | Detail |
| --- | --- | --- | --- |
${preflightRows || '| - | - | - | no preflight checks |'}

## Case Results

| Surface | Case | Status | Detail | Screenshot |
| --- | --- | --- | --- | --- |
${caseRows || '| - | - | - | no cases | - |'}

## Parity

- Status: ${report.parity?.status || 'n/a'}
- Detail: ${report.parity?.detail || 'n/a'}

## Failure Summary

${report.failureSummary?.length ? report.failureSummary.map((item) => `- ${item}`).join('\n') : '- none'}

## Auth Responses

${responseBlocks}
`;
}

async function writeReports(report) {
  await writeReportArtifacts({
    paths: reportPaths,
    report,
    renderMarkdown,
  });
}

async function fetchSurfaceCheck(
  fetchImpl,
  url,
  {
    attempts = PREFLIGHT_CHECK_RETRY_ATTEMPTS,
    retryDelayMs = PREFLIGHT_CHECK_RETRY_DELAY_MS,
  } = {}
) {
  let lastFailure = 'unknown error';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
      });

      if (response.status < 400) {
        return {
          status: 'passed',
          detail:
            attempt === 1
              ? `reachable (${response.status})`
              : `reachable (${response.status}) after retry ${attempt}/${attempts}`,
        };
      }

      lastFailure = `unreachable (${response.status})`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      await sleep(retryDelayMs);
    }
  }

  return {
    status: 'failed',
    detail: lastFailure,
  };
}

export async function runPreflightChecks(
  { vercelUrl, cloudflareUrl, callbackPathInput },
  fetchImpl = fetch
) {
  const checks = [];
  let normalizedCallbackPath = null;
  let vercelOrigin = null;
  let cloudflareOrigin = null;

  try {
    normalizedCallbackPath =
      authSpikeShared.normalizeCallbackPath(callbackPathInput);
    checks.push({
      name: 'callback-path',
      status: 'passed',
      detail: normalizedCallbackPath,
      surface: 'global',
    });
  } catch (error) {
    checks.push({
      name: 'callback-path',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
      surface: 'global',
    });

    return { checks, normalizedCallbackPath };
  }

  try {
    vercelOrigin = new URL(vercelUrl).origin;
    checks.push({
      name: 'vercel-url',
      status: 'passed',
      detail: vercelOrigin,
      surface: 'vercel',
    });
  } catch (error) {
    checks.push({
      name: 'vercel-url',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
      surface: 'vercel',
    });
  }

  try {
    cloudflareOrigin = new URL(cloudflareUrl).origin;
    checks.push({
      name: 'cloudflare-url',
      status: 'passed',
      detail: cloudflareOrigin,
      surface: 'cloudflare',
    });
  } catch (error) {
    checks.push({
      name: 'cloudflare-url',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
      surface: 'cloudflare',
    });
  }

  checks.push({
    name: 'distinct-surfaces',
    status:
      vercelOrigin && cloudflareOrigin && vercelOrigin !== cloudflareOrigin
        ? 'passed'
        : 'failed',
    detail:
      vercelOrigin && cloudflareOrigin && vercelOrigin !== cloudflareOrigin
        ? 'surface URLs are distinct'
        : 'Vercel 与 Cloudflare URL 必须是不同且有效的 origin',
    surface: 'global',
  });

  for (const [surface, baseUrl] of [
    ['vercel', vercelUrl],
    ['cloudflare', cloudflareUrl],
  ]) {
    if (!(surface === 'vercel' ? vercelOrigin : cloudflareOrigin)) {
      continue;
    }

    for (const [name, pathname] of [
      ['sign-in-page', '/sign-in'],
      ['sign-up-page', '/sign-up'],
      ['callback-page', normalizedCallbackPath],
    ]) {
      const result = await fetchSurfaceCheck(
        fetchImpl,
        new URL(pathname, baseUrl)
      );
      checks.push({
        name,
        status: result.status,
        detail: result.detail,
        surface,
      });
    }
  }

  return { checks, normalizedCallbackPath };
}

async function main() {
  const missing = getMissingEnvNames();
  if (missing.length > 0) {
    process.stderr.write(
      `Missing auth spike env vars: ${missing.join(', ')}\n` +
        'Required: AUTH_SPIKE_VERCEL_URL, AUTH_SPIKE_CF_URL, AUTH_SPIKE_EMAIL, AUTH_SPIKE_PASSWORD, AUTH_SPIKE_CALLBACK_PATH\n'
    );
    process.exit(1);
  }

  await mkdir(reportDir, { recursive: true });

  const runId = process.env.AUTH_SPIKE_RUN_ID?.trim() || timestamp;
  const emails = authSpikeShared.buildSurfaceRunEmails(
    process.env.AUTH_SPIKE_EMAIL?.trim() || 'auth-spike@example.com',
    runId
  );
  const preflight = await runPreflightChecks({
    vercelUrl: process.env.AUTH_SPIKE_VERCEL_URL?.trim() || '',
    cloudflareUrl: process.env.AUTH_SPIKE_CF_URL?.trim() || '',
    callbackPathInput: process.env.AUTH_SPIKE_CALLBACK_PATH?.trim() || '',
  });
  const report = authSpikeShared.createEmptyReport({
    callbackPath:
      preflight.normalizedCallbackPath ||
      process.env.AUTH_SPIKE_CALLBACK_PATH?.trim() ||
      '',
    commitSha: readCommitShaSafely(),
    emails,
    runId,
  });
  report.preflight = preflight.checks;

  if (
    !preflight.normalizedCallbackPath ||
    preflight.checks.some((check) => check.status === 'failed')
  ) {
    const conclusion = authSpikeShared.deriveConclusion(report);
    report.rawConclusion = conclusion.rawConclusion;
    report.harnessStatus = conclusion.harnessStatus;
    report.failureSummary = conclusion.failureSummary;
    await writeReports(report);

    process.stdout.write(
      `${formatHarnessSummaryLines({
        label: 'auth-spike',
        rootDir,
        reportMarkdownPath: reportPaths.reportMarkdownPath,
        report,
      }).join('\n')}\n`
    );
    process.exit(resolveHarnessExitCode(report, 0));
  }

  const childEnv = {
    ...process.env,
    AUTH_SPIKE_REPORT_JSON: reportPaths.reportJsonPath,
    AUTH_SPIKE_ARTIFACT_DIR: reportPaths.artifactDir,
    AUTH_SPIKE_COMMIT_SHA: report.commitSha,
    AUTH_SPIKE_RUN_ID: runId,
    AUTH_SPIKE_CALLBACK_PATH: preflight.normalizedCallbackPath,
    AUTH_SPIKE_VERCEL_EMAIL: emails.vercel,
    AUTH_SPIKE_CF_EMAIL: emails.cloudflare,
  };

  const child = spawn(
    process.execPath,
    ['--test', '--import', 'tsx', 'tests/smoke/auth-dual-runtime.test.ts'],
    {
      cwd: rootDir,
      env: childEnv,
      stdio: 'inherit',
    }
  );

  const exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
  });

  let childReport;
  try {
    childReport = JSON.parse(
      await readFile(reportPaths.reportJsonPath, 'utf8')
    );
  } catch (error) {
    process.stderr.write(
      `Auth spike test finished with code ${exitCode}, but report JSON is missing: ${String(error)}\n`
    );
    process.exit(typeof exitCode === 'number' ? exitCode : 1);
  }

  childReport.preflight = report.preflight;
  await writeReports(report);
  await writeReports(childReport);

  process.stdout.write(
    `${formatHarnessSummaryLines({
      label: 'auth-spike',
      rootDir,
      reportMarkdownPath: reportPaths.reportMarkdownPath,
      report: childReport,
    }).join('\n')}\n`
  );

  process.exit(resolveHarnessExitCode(childReport, exitCode));
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
