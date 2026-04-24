import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runAuthSurface } from '../../src/testing/auth-spike.browser';
import {
  AUTH_SPIKE_REQUIRED_ENV_NAMES,
  buildSurfaceRunEmails,
  createEmptyReport,
  deriveConclusion,
  deriveParityResult,
  normalizeCallbackPath,
} from '../../src/testing/auth-spike.shared';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reportJsonPath =
  process.env.AUTH_SPIKE_REPORT_JSON ||
  resolve(
    rootDir,
    '.gstack/projects/Larrybin-aooi/auth-spike-report.latest.json'
  );
const artifactDir =
  process.env.AUTH_SPIKE_ARTIFACT_DIR ||
  resolve(rootDir, 'output/playwright/auth-spike/latest');

const missingEnvNames = AUTH_SPIKE_REQUIRED_ENV_NAMES.filter(
  (name) => !process.env[name]?.trim()
);

const callbackPath =
  process.env.AUTH_SPIKE_CALLBACK_PATH?.trim() || '/settings/profile';
const runId = process.env.AUTH_SPIKE_RUN_ID?.trim() || 'latest';
const emails = buildSurfaceRunEmails(
  process.env.AUTH_SPIKE_EMAIL?.trim() || 'auth-spike@example.com',
  runId
);

const env = {
  vercelUrl: process.env.AUTH_SPIKE_VERCEL_URL?.trim() || '',
  cloudflareUrl: process.env.AUTH_SPIKE_CF_URL?.trim() || '',
  emails: {
    vercel: process.env.AUTH_SPIKE_VERCEL_EMAIL?.trim() || emails.vercel,
    cloudflare: process.env.AUTH_SPIKE_CF_EMAIL?.trim() || emails.cloudflare,
  },
  password: process.env.AUTH_SPIKE_PASSWORD?.trim() || '',
  callbackPath: normalizeCallbackPath(callbackPath),
  userName: process.env.AUTH_SPIKE_USER_NAME?.trim() || 'Auth Spike User',
  commitSha:
    process.env.AUTH_SPIKE_COMMIT_SHA?.trim() || readCommitShaSafely(rootDir),
  runId,
};

function readCommitShaSafely(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

async function ensureDir(pathname: string) {
  await mkdir(pathname, { recursive: true });
}

async function writeJsonReport(report: unknown) {
  await ensureDir(dirname(reportJsonPath));
  await writeFile(
    reportJsonPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
}

if (missingEnvNames.length > 0) {
  test(
    'auth spike dual runtime',
    { skip: `Missing env: ${missingEnvNames.join(', ')}` },
    () => {}
  );
} else {
  test('auth spike dual runtime', { timeout: 180_000 }, async () => {
    const report = createEmptyReport({
      callbackPath: env.callbackPath,
      commitSha: env.commitSha,
      emails: env.emails,
      runId: env.runId,
    });

    try {
      report.surfaces.push(
        await runAuthSurface({
          surfaceName: 'vercel',
          baseUrl: env.vercelUrl,
          emailUsed: env.emails.vercel,
          password: env.password,
          callbackPath: env.callbackPath,
          userName: env.userName,
          artifactDir,
        })
      );
      report.surfaces.push(
        await runAuthSurface({
          surfaceName: 'cloudflare',
          baseUrl: env.cloudflareUrl,
          emailUsed: env.emails.cloudflare,
          password: env.password,
          callbackPath: env.callbackPath,
          userName: env.userName,
          artifactDir,
        })
      );
      report.parity = deriveParityResult(report);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      report.failureSummary.push(`fatal:${message}`);
      throw error;
    } finally {
      if (!report.parity && report.surfaces.length >= 2) {
        try {
          report.parity = deriveParityResult(report);
        } catch {
          // ignore parity fallback failure so we still emit the report
        }
      }

      const conclusion = deriveConclusion(report);
      report.rawConclusion = conclusion.rawConclusion;
      report.harnessStatus = conclusion.harnessStatus;
      report.failureSummary = Array.from(
        new Set([...report.failureSummary, ...conclusion.failureSummary])
      );

      await writeJsonReport(report);
    }
  });
}
