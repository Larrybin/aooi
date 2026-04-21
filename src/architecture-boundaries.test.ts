import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const srcRoot = path.resolve(repoRoot, 'src');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const DIRS_TO_SKIP = new Set(['.next', 'node_modules']);
const requiredTargetDirectories = [
  'src/domains/chat',
  'src/domains/account',
  'src/domains/billing',
  'src/domains/settings',
  'src/domains/access-control',
  'src/domains/content',
  'src/surfaces/admin',
  'src/infra/platform',
  'src/infra/adapters',
  'src/infra/runtime',
];

const legacyArchitectureDirectories = [
  'src/core',
  'src/features',
  'src/shared/models',
  'src/shared/services',
];

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
    baseline: 0,
  },
  {
    label: '@/shared/services',
    pattern: importPatterns.sharedServices,
    baseline: 0,
  },
  {
    label: '@/core',
    pattern: importPatterns.core,
    baseline: 0,
  },
  {
    label: '@/features',
    pattern: importPatterns.features,
    baseline: 0,
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

test('architecture: 目标收敛目录必须存在', async () => {
  for (const requiredDir of requiredTargetDirectories) {
    const dirStat = await stat(path.resolve(repoRoot, requiredDir));
    assert.equal(
      dirStat.isDirectory(),
      true,
      `${requiredDir} 必须存在，避免后续能力继续落回 shared/core/features`
    );
  }
});

test('architecture: 旧架构目录已删除', async () => {
  for (const legacyDir of legacyArchitectureDirectories) {
    await assert.rejects(
      () => stat(path.resolve(repoRoot, legacyDir)),
      { code: 'ENOENT' },
      `${legacyDir} 不应继续存在，避免新代码落回旧业务层`
    );
  }
});

test('architecture: 旧脏入口引用保持归零', async () => {
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
      `${rule.label} 引用数必须保持 ${rule.baseline}，当前为 ${count}`
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

test('architecture: 新目标目录不回引旧架构入口', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/(?:domains|surfaces|infra)\//.test(repoPath) && !isTestFile(repoPath)
  );
  const forbiddenLegacyImportPattern =
    /@\/(?:core|features|shared\/models|shared\/services)(?:\/|['"])/;

  for (const file of files) {
    assert.equal(
      forbiddenLegacyImportPattern.test(file.content),
      false,
      `${file.repoPath} 不应回引 core/features/shared models/services`
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

test('architecture: content domain 不拥有 composition/platform/runtime 职责', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/content\//.test(repoPath)
  );
  const forbiddenContentImportPattern =
    /@\/(?:app|infra\/platform\/i18n|infra\/runtime|themes)(?:\/|['"])|next\/navigation|generateMetadata|Metadata\s+from\s+['"]next/;

  for (const file of files) {
    assert.equal(
      forbiddenContentImportPattern.test(file.content),
      false,
      `${file.repoPath} 不应拥有 SEO/i18n runtime/route segmentation/theme rendering 职责`
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
