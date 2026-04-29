import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const coverageEnabled = args.includes('--coverage');

const TEST_FILE_PATTERN = /\.(test|spec)\.(t|j)sx?$/;
const SERVER_TEST_FILE_PATTERN = /\.server\.(test|spec)\.(t|j)sx?$/;
const IGNORED_DIRS = new Set(['.git', '.next', 'dist', 'node_modules', 'out']);
const EXCLUDED_TEST_FILES = new Set([
  'src/architecture-boundaries.test.ts',
  'tests/smoke/auth-dual-runtime.test.ts',
]);

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function collectTestFiles(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await collectTestFiles(resolve(dir, entry.name), out);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!TEST_FILE_PATTERN.test(entry.name)) continue;

    const filePath = resolve(dir, entry.name);
    const repoPath = relative(ROOT_DIR, filePath).split(sep).join('/');
    if (EXCLUDED_TEST_FILES.has(repoPath)) continue;

    out.push(filePath);
  }
}

async function main() {
  process.chdir(ROOT_DIR);

  const candidateRoots = [];
  for (const name of ['src', 'test', 'tests', 'scripts']) {
    const path = resolve(ROOT_DIR, name);
    if (await isDirectory(path)) candidateRoots.push(path);
  }

  const testFiles = [];
  for (const root of candidateRoots) {
    await collectTestFiles(root, testFiles);
  }

  testFiles.sort((a, b) => a.localeCompare(b));

  if (testFiles.length === 0) {
    process.stderr.write(
      'No test files found (expected **/*.test.(t|j)s(x) or **/*.spec.(t|j)s(x)).\n'
    );
    process.exit(1);
  }

  const defaultTestFiles = testFiles.filter(
    (filePath) => !SERVER_TEST_FILE_PATTERN.test(filePath)
  );
  const reactServerTestFiles = testFiles.filter((filePath) =>
    SERVER_TEST_FILE_PATTERN.test(filePath)
  );

  for (const command of [
    {
      label: 'default',
      useReactServer: false,
      files: defaultTestFiles,
    },
    {
      label: 'react-server',
      useReactServer: true,
      files: reactServerTestFiles,
    },
  ]) {
    if (command.files.length === 0) continue;

    const nodeArgs = ['--test', '--import', 'tsx', ...command.files];
    if (command.useReactServer) {
      nodeArgs.unshift('react-server');
      nodeArgs.unshift('--conditions');
    }
    if (coverageEnabled) nodeArgs.unshift('--experimental-test-coverage');

    const exitCode = await new Promise((resolveExitCode) => {
      const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit' });
      child.on('exit', (code, signal) => {
        if (typeof code === 'number') {
          resolveExitCode(code);
          return;
        }
        if (signal) {
          process.stderr.write(
            `Tests (${command.label}) terminated by signal: ${signal}\n`
          );
        }
        resolveExitCode(1);
      });
    });

    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

await main();
