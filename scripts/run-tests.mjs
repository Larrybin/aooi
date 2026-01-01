import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const coverageEnabled = args.includes('--coverage');

const TEST_FILE_PATTERN = /\.(test|spec)\.(t|j)sx?$/;
const IGNORED_DIRS = new Set(['.git', '.next', 'dist', 'node_modules', 'out']);

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

    out.push(resolve(dir, entry.name));
  }
}

async function main() {
  process.chdir(ROOT_DIR);

  const candidateRoots = [];
  for (const name of ['src', 'test', 'tests']) {
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

  const nodeArgs = ['--test', '--import', 'tsx', ...testFiles];
  if (coverageEnabled) nodeArgs.unshift('--experimental-test-coverage');

  const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (typeof code === 'number') process.exit(code);
    if (signal) {
      process.stderr.write(`Tests terminated by signal: ${signal}\n`);
    }
    process.exit(1);
  });
}

await main();
