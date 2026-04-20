import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const srcRoot = path.resolve(repoRoot, 'src');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const DIRS_TO_SKIP = new Set(['.next', 'node_modules']);

type DirtyImportRule = {
  label: string;
  pattern: RegExp;
  baseline: number;
};

async function collectSourceFiles(currentDir: string): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (DIRS_TO_SKIP.has(entry.name)) continue;
      files.push(...(await collectSourceFiles(path.join(currentDir, entry.name))));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;

    files.push(path.join(currentDir, entry.name));
  }

  return files;
}

function toRepoPath(filePath: string) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

async function readSourceFiles() {
  const files = await collectSourceFiles(srcRoot);
  return Promise.all(
    files.map(async (filePath) => ({
      filePath,
      repoPath: toRepoPath(filePath),
      content: await readFile(filePath, 'utf8'),
    }))
  );
}

function countMatches(content: string, pattern: RegExp) {
  return [...content.matchAll(new RegExp(pattern, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))].length;
}

function isTestFile(repoPath: string) {
  return /\.(test|spec)\.tsx?$/.test(repoPath);
}

const importPatterns = {
  sharedModels:
    /(?:from\s+['"]@\/shared\/models(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@\/shared\/models(?:\/[^'"]*)?['"]\s*\))/g,
  sharedServices:
    /(?:from\s+['"]@\/shared\/services(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@\/shared\/services(?:\/[^'"]*)?['"]\s*\))/g,
  core:
    /(?:from\s+['"]@\/core(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@\/core(?:\/[^'"]*)?['"]\s*\))/g,
  features:
    /(?:from\s+['"]@\/features(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@\/features(?:\/[^'"]*)?['"]\s*\))/g,
};

const dirtyImportRules: DirtyImportRule[] = [
  {
    label: '@/shared/models',
    pattern: importPatterns.sharedModels,
    baseline: 145,
  },
  {
    label: '@/shared/services',
    pattern: importPatterns.sharedServices,
    baseline: 49,
  },
  {
    label: '@/core',
    pattern: importPatterns.core,
    baseline: 185,
  },
  {
    label: '@/features',
    pattern: importPatterns.features,
    baseline: 68,
  },
];

const publicCompositionPathPatterns = [
  /^src\/app\/\[locale\]\/\(landing\)\/(?:page|layout)\.tsx$/,
  /^src\/app\/\[locale\]\/\(landing\)\/pricing\//,
  /^src\/app\/\[locale\]\/\(landing\)\/blog\//,
  /^src\/app\/\[locale\]\/\(landing\)\/\[slug\]\//,
  /^src\/app\/\[locale\]\/\(docs\)\//,
];

function isPublicCompositionFile(repoPath: string) {
  return publicCompositionPathPatterns.some((pattern) => pattern.test(repoPath));
}

function readImportSpecifiers(source: string) {
  const specifiers = new Set<string>();
  const importFromPattern =
    /^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm;
  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  const sideEffectImportPattern = /^\s*import\s+['"]([^'"]+)['"]/gm;

  for (const pattern of [
    importFromPattern,
    dynamicImportPattern,
    sideEffectImportPattern,
  ]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier) specifiers.add(specifier);
    }
  }

  return [...specifiers];
}

test('architecture: 旧脏入口引用数量只减不增', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) => repoPath !== 'src/architecture-boundaries.test.ts'
  );

  for (const rule of dirtyImportRules) {
    const count = files.reduce(
      (total, file) => total + countMatches(file.content, rule.pattern),
      0
    );

    assert.equal(
      count <= rule.baseline,
      true,
      `${rule.label} 引用数 ${count} 超过 Phase 0 baseline ${rule.baseline}`
    );
  }
});

test('architecture: 新目标 domain 层不依赖入站层、adapter 或 HTTP schema', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/domain\//.test(repoPath)
  );

  for (const file of files) {
    assert.equal(
      /@\/(?:app|surfaces|infra\/adapters|shared\/schemas\/api)(?:\/|['"])/.test(
        file.content
      ),
      false,
      `${file.repoPath} 不应依赖 app/surfaces/infra/adapters/shared/schemas/api`
    );
    assert.equal(
      /from\s+['"]next\//.test(file.content),
      false,
      `${file.repoPath} 不应依赖 Next.js API`
    );
  }
});

test('architecture: access-control domain/application 不包含 Web 拒绝行为', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/access-control\//.test(repoPath)
  );

  for (const file of files) {
    assert.equal(
      /next\/navigation|redirect\s*\(|notFound\s*\(/.test(file.content),
      false,
      `${file.repoPath} 不应包含 redirect/notFound/next/navigation`
    );
  }
});

test('architecture: shared/schemas/api 只保存 HTTP wire contract', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/shared\/schemas\/api\//.test(repoPath)
  );

  for (const file of files) {
    assert.equal(
      /@\/(?:domains|shared\/models|shared\/services|infra|core|features)(?:\/|['"])/.test(
        file.content
      ),
      false,
      `${file.repoPath} 不应依赖业务模块或 infra`
    );
  }
});

test('architecture: Public Composition Layer 只导入只读 domain 入口', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    isPublicCompositionFile(repoPath)
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        /^@\/infra\/adapters(?:\/|$)/.test(specifier),
        false,
        `${file.repoPath} 不应导入 infra/adapters`
      );

      const match = specifier.match(
        /^@\/domains\/[^/]+\/application\/(.+)$/
      );
      if (!match) continue;

      assert.equal(
        /\.(?:query|view)(?:\.[^/.]+)?$/.test(match[1]),
        true,
        `${file.repoPath} 只能导入 *.query 或 *.view 只读 domain 入口: ${specifier}`
      );
    }
  }
});

test('architecture: settings 不拥有业务域实现', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/(?:domains\/settings|shared\/services\/settings)\//.test(repoPath)
  );

  for (const file of files) {
    if (isTestFile(file.repoPath)) continue;
    assert.equal(
      /@\/(?:domains|core)\/(?:billing|chat|account|payment|rbac)(?:\/|['"])/.test(
        file.content
      ),
      false,
      `${file.repoPath} 不应依赖 billing/chat/account/payment/rbac 业务实现`
    );
  }
});

test('architecture: 跨域 application 依赖只能指向只读入口', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\//.test(repoPath)
  );

  for (const file of files) {
    const [, sourceDomain] =
      file.repoPath.match(/^src\/domains\/([^/]+)\/application\//) ?? [];
    assert.ok(sourceDomain, `${file.repoPath} 应属于明确的 domain application`);

    for (const specifier of readImportSpecifiers(file.content)) {
      const match = specifier.match(
        /^@\/domains\/([^/]+)\/application\/(.+)$/
      );
      if (!match) continue;

      const [, targetDomain, targetPath] = match;
      if (targetDomain === sourceDomain) continue;

      assert.equal(
        /\.(?:query|view)(?:\.[^/.]+)?$/.test(targetPath),
        true,
        `${file.repoPath} 跨域依赖 ${specifier} 必须指向 *.query 或 *.view 只读入口`
      );
    }
  }
});
