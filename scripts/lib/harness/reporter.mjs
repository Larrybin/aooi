import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createReportArtifacts({
  rootDir,
  timestamp,
  reportPrefix,
  artifactSubdir,
}) {
  const reportDir = path.resolve(rootDir, '.gstack/projects/Larrybin-aooi');
  const reportBaseName = `${reportPrefix}-${timestamp}`;
  const reportJsonPath = path.resolve(reportDir, `${reportBaseName}.json`);
  const reportMarkdownPath = path.resolve(reportDir, `${reportBaseName}.md`);
  const latestJsonPath = path.resolve(reportDir, `${reportPrefix}.latest.json`);
  const latestMarkdownPath = path.resolve(
    reportDir,
    `${reportPrefix}.latest.md`
  );
  const artifactDir = path.resolve(rootDir, 'output/playwright', artifactSubdir, timestamp);

  return {
    reportDir,
    reportBaseName,
    reportJsonPath,
    reportMarkdownPath,
    latestJsonPath,
    latestMarkdownPath,
    artifactDir,
  };
}

export async function writeReportArtifacts({
  paths,
  report,
  renderMarkdown,
  sanitizeReport,
}) {
  await mkdir(paths.reportDir, { recursive: true });
  const outputReport = sanitizeReport ? sanitizeReport(report) : report;
  const markdown = renderMarkdown(outputReport);
  const json = `${JSON.stringify(outputReport, null, 2)}\n`;

  await writeFile(paths.reportJsonPath, json, 'utf8');
  await writeFile(paths.reportMarkdownPath, markdown, 'utf8');
  await writeFile(paths.latestJsonPath, json, 'utf8');
  await writeFile(paths.latestMarkdownPath, markdown, 'utf8');

  return outputReport;
}

export function resolveHarnessExitCode(report, childExitCode) {
  if (typeof childExitCode === 'number' && childExitCode !== 0) {
    return childExitCode;
  }

  return report.harnessStatus === 'PASS' ? 0 : 1;
}

export function formatHarnessSummaryLines({
  label,
  rootDir,
  reportMarkdownPath,
  report,
  extras = [],
}) {
  return [
    `[${label}] report: ${path.relative(rootDir, reportMarkdownPath)}`,
    `[${label}] harness: ${report.harnessStatus}`,
    `[${label}] raw conclusion: ${report.rawConclusion}`,
    ...extras,
  ];
}
