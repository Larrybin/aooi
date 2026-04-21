import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { ARCHITECTURE_RULES } from '@/testing/architecture-rules';

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

const dirtyImportRules: DirtyImportRule[] = ARCHITECTURE_RULES.dirtyImports.map(
  (label) => {
    switch (label) {
      case '@/shared/models':
        return { label, pattern: importPatterns.sharedModels, baseline: 0 };
      case '@/shared/services':
        return { label, pattern: importPatterns.sharedServices, baseline: 0 };
      case '@/core':
        return { label, pattern: importPatterns.core, baseline: 0 };
      case '@/features':
        return { label, pattern: importPatterns.features, baseline: 0 };
      default:
        throw new Error(`Unsupported dirty import rule: ${label}`);
    }
  }
);

const publicCompositionPathPatterns =
  ARCHITECTURE_RULES.publicCompositionPathPatterns.map(
    (pattern) => new RegExp(pattern)
  );
const domainForbiddenImportPatterns =
  ARCHITECTURE_RULES.domainForbiddenImports.map(
    (pattern) => new RegExp(pattern)
  );
const applicationAllowedPlatformImportPatterns =
  ARCHITECTURE_RULES.applicationAllowedPlatformImports.map(
    (pattern) => new RegExp(pattern)
  );
const applicationPlatformImportExceptions =
  ARCHITECTURE_RULES.applicationPlatformImportExceptions.map((exception) => ({
    file: exception.file,
    imports: exception.imports.map((pattern) => new RegExp(pattern)),
  }));
const queryViewAllowedSameDomainApplicationPathPattern = new RegExp(
  ARCHITECTURE_RULES.queryViewAllowedSameDomainApplicationPathPattern
);
const sharedLibAllowedPathPatterns =
  ARCHITECTURE_RULES.sharedLibAllowedPathPatterns.map(
    (pattern) => new RegExp(pattern)
  );
const aggregationPathPattern = new RegExp(
  ARCHITECTURE_RULES.aggregation.pathPattern
);
const orchestrationPathPattern = new RegExp(
  ARCHITECTURE_RULES.orchestration.pathPattern
);

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

function parseDomainApplicationPath(repoPath: string) {
  const match = repoPath.match(/^src\/domains\/([^/]+)\/application\/(.+)$/);
  if (!match) return;

  return {
    domain: match[1],
    applicationPath: match[2],
  };
}

function isAggregationFile(repoPath: string) {
  return aggregationPathPattern.test(repoPath);
}

function isOrchestrationFile(repoPath: string) {
  return orchestrationPathPattern.test(repoPath);
}

function assertHasMarker(
  content: string,
  marker: string,
  repoPath: string
) {
  assert.equal(
    content.includes(marker),
    true,
    `${repoPath} 必须包含 ${marker}`
  );
}

function assertHasPattern(
  content: string,
  pattern: string,
  repoPath: string,
  message: string
) {
  assert.equal(new RegExp(pattern).test(content), true, `${repoPath} ${message}`);
}

function countByDomain(files: Array<{ repoPath: string }>) {
  const counts = new Map<string, number>();
  for (const file of files) {
    const domain = file.repoPath.match(/^src\/domains\/([^/]+)\//)?.[1];
    assert.ok(domain, `${file.repoPath} 应属于明确 domain`);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return counts;
}

function isAllowedApplicationPlatformException(
  repoPath: string,
  specifier: string
) {
  const exception = applicationPlatformImportExceptions.find(
    (item) => item.file === repoPath
  );
  if (!exception) return false;

  return exception.imports.some((pattern) => pattern.test(specifier));
}

test('architecture: 目标收敛目录必须存在', async () => {
  for (const requiredDir of ARCHITECTURE_RULES.requiredTargetDirectories) {
    const dirStat = await stat(path.resolve(repoRoot, requiredDir));
    assert.equal(
      dirStat.isDirectory(),
      true,
      `${requiredDir} 必须存在，避免后续能力继续落回 shared/core/features`
    );
  }
});

test('architecture: 旧架构目录已删除', async () => {
  for (const legacyDir of ARCHITECTURE_RULES.legacyArchitectureDirectories) {
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
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        domainForbiddenImportPatterns.some((pattern) =>
          pattern.test(specifier)
        ),
        false,
        `${file.repoPath} 不应依赖 ${specifier}`
      );
    }
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
    /^src\/domains\/settings\//.test(repoPath)
  );
  const forbiddenImportPattern = new RegExp(
    `^@/(?:domains|core)/(?:${ARCHITECTURE_RULES.settingsForbiddenBusinessImports.join('|')})(?:/|$)`
  );

  for (const file of files) {
    if (isTestFile(file.repoPath)) continue;
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        forbiddenImportPattern.test(specifier),
        false,
        `${file.repoPath} 不应依赖 ${specifier} 业务实现`
      );
    }
  }
});

test('architecture: 跨域 application 依赖只能指向只读入口', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\//.test(repoPath)
  );

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);

    for (const specifier of readImportSpecifiers(file.content)) {
      const match = specifier.match(
        /^@\/domains\/([^/]+)\/application\/(.+)$/
      );
      if (!match) continue;

      const [, targetDomain, targetPath] = match;
      if (targetDomain === source.domain) continue;

      assert.equal(
        /\.(?:query|view)(?:\.[^/.]+)?$/.test(targetPath),
        true,
        `${file.repoPath} 跨域依赖 ${specifier} 必须指向 *.query 或 *.view 只读入口`
      );
    }
  }
});

test('architecture: application 只能使用受控 platform 入口', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\//.test(repoPath)
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      if (!specifier.startsWith('@/infra/platform/')) continue;
      if (isAllowedApplicationPlatformException(file.repoPath, specifier)) {
        continue;
      }

      assert.equal(
        applicationAllowedPlatformImportPatterns.some((pattern) =>
          pattern.test(specifier)
        ),
        true,
        `${file.repoPath} 只能导入 logging/request context platform 入口: ${specifier}`
      );
    }
  }
});

test('architecture: application 默认外域 fan-out 不超过预算', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) =>
      /^src\/domains\/[^/]+\/application\//.test(repoPath) &&
      !isTestFile(repoPath) &&
      !isAggregationFile(repoPath) &&
      !isOrchestrationFile(repoPath)
  );

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);

    const targetDomains = new Set<string>();
    for (const specifier of readImportSpecifiers(file.content)) {
      const match = specifier.match(/^@\/domains\/([^/]+)\/application\/(.+)$/);
      if (!match) continue;

      const [, targetDomain, targetPath] = match;
      if (targetDomain === source.domain) continue;
      if (!/\.(?:query|view)(?:\.[^/.]+)?$/.test(targetPath)) continue;

      targetDomains.add(targetDomain);
    }

    assert.equal(
      targetDomains.size <= ARCHITECTURE_RULES.applicationFanOutLimit,
      true,
      `${file.repoPath} 外域 application fan-out ${targetDomains.size} 超过预算 ${ARCHITECTURE_RULES.applicationFanOutLimit}`
    );
  }
});

test('architecture: query/view 只做同域读取或投影', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\/.*\.(?:query|view)\.ts$/.test(repoPath)
  );

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);

    for (const specifier of readImportSpecifiers(file.content)) {
      const domainAppImport = specifier.match(
        /^@\/domains\/([^/]+)\/application\/(.+)$/
      );
      if (domainAppImport) {
        const [, targetDomain, targetPath] = domainAppImport;
        assert.equal(
          targetDomain,
          source.domain,
          `${file.repoPath} query/view 不应导入外域 application: ${specifier}`
        );
        if (targetDomain !== source.domain) {
          assert.equal(
            queryViewAllowedSameDomainApplicationPathPattern.test(targetPath),
            true,
            `${file.repoPath} query/view 只能导入外域 query/view application: ${specifier}`
          );
        }
      }

      assert.equal(
        /^@\/domains\/settings\/application\/settings-store$/.test(specifier),
        false,
        `${file.repoPath} query/view 不应导入 settings-store`
      );
      assert.equal(
        /^@\/infra\/adapters(?:\/|$)/.test(specifier),
        false,
        `${file.repoPath} query/view 不应导入 infra/adapters`
      );
    }
  }
});

test('architecture: aggregation 例外必须显式标注并保持只读', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    isAggregationFile(repoPath)
  );

  assert.equal(
    files.length <= ARCHITECTURE_RULES.aggregation.totalBudget,
    true,
    `aggregation 文件总数 ${files.length} 超过预算 ${ARCHITECTURE_RULES.aggregation.totalBudget}`
  );

  for (const [domain, count] of countByDomain(files)) {
    assert.equal(
      count <= ARCHITECTURE_RULES.aggregation.perDomainBudget,
      true,
      `${domain} aggregation 文件数 ${count} 超过预算 ${ARCHITECTURE_RULES.aggregation.perDomainBudget}`
    );
  }

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);
    assertHasMarker(
      file.content,
      ARCHITECTURE_RULES.aggregation.marker,
      file.repoPath
    );
    assertHasPattern(
      file.content,
      ARCHITECTURE_RULES.aggregation.reasonPattern,
      file.repoPath,
      '必须写明 reason'
    );

    for (const specifier of readImportSpecifiers(file.content)) {
      const domainAppImport = specifier.match(
        /^@\/domains\/([^/]+)\/application\/(.+)$/
      );
      if (domainAppImport) {
        const [, targetDomain, targetPath] = domainAppImport;
        if (targetDomain === source.domain) continue;
        assert.equal(
          /\.(?:query|view)(?:\.[^/.]+)?$/.test(targetPath),
          true,
          `${file.repoPath} aggregation 只能依赖外域 query/view: ${specifier}`
        );
      }
      assert.equal(
        /\/application\/orchestration\//.test(specifier),
        false,
        `${file.repoPath} aggregation 不应导入 orchestration`
      );
    }
  }
});

test('architecture: orchestration 例外必须显式标注并禁止嵌套', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    isOrchestrationFile(repoPath)
  );

  assert.equal(
    files.length <= ARCHITECTURE_RULES.orchestration.totalBudget,
    true,
    `orchestration 文件总数 ${files.length} 超过预算 ${ARCHITECTURE_RULES.orchestration.totalBudget}`
  );

  for (const [domain, count] of countByDomain(files)) {
    assert.equal(
      count <= ARCHITECTURE_RULES.orchestration.perDomainBudget,
      true,
      `${domain} orchestration 文件数 ${count} 超过预算 ${ARCHITECTURE_RULES.orchestration.perDomainBudget}`
    );
  }

  for (const file of files) {
    assertHasMarker(
      file.content,
      ARCHITECTURE_RULES.orchestration.marker,
      file.repoPath
    );
    assertHasPattern(
      file.content,
      ARCHITECTURE_RULES.orchestration.reasonPattern,
      file.repoPath,
      '必须写明 reason'
    );
    assertHasPattern(
      file.content,
      ARCHITECTURE_RULES.orchestration.ownerPattern,
      file.repoPath,
      '必须写明 owner'
    );
    assertHasPattern(
      file.content,
      ARCHITECTURE_RULES.orchestration.failureCompensationPattern,
      file.repoPath,
      '必须写明 failure-compensation'
    );

    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        /\/application\/orchestration\//.test(specifier),
        false,
        `${file.repoPath} orchestration 不应嵌套导入 orchestration`
      );
      assert.equal(
        /^@\/domains\/[^/]+\/(?:infra|repository|provider)(?:\/|$)/.test(
          specifier
        ),
        false,
        `${file.repoPath} orchestration 不应导入外域 infra/repository/provider: ${specifier}`
      );
    }
  }
});

test('architecture: aggregation/orchestration 不能被外域 application 调用', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\//.test(repoPath)
  );

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);

    for (const specifier of readImportSpecifiers(file.content)) {
      const match = specifier.match(/^@\/domains\/([^/]+)\/application\/(.+)$/);
      if (!match) continue;
      const [, targetDomain, targetPath] = match;
      if (targetDomain === source.domain) continue;

      assert.equal(
        /^(?:aggregation|orchestration)\//.test(targetPath),
        false,
        `${file.repoPath} 不应调用外域 aggregation/orchestration: ${specifier}`
      );
    }
  }
});

test('architecture: shared/lib 只保留 allowlist 纯工具', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/shared\/lib\//.test(repoPath)
  );

  for (const file of files) {
    const sharedLibPath = file.repoPath.replace(/^src\/shared\/lib\//, '');
    assert.equal(
      sharedLibAllowedPathPatterns.some((pattern) =>
        pattern.test(sharedLibPath)
      ),
      true,
      `${file.repoPath} 不在 shared/lib allowlist 中`
    );

    for (const token of ARCHITECTURE_RULES.sharedLibForbiddenSemanticNames) {
      assert.equal(
        new RegExp(`(?:^|/)${token}(?:[./-]|$)`).test(sharedLibPath),
        false,
        `${file.repoPath} 命中业务语义入口名 ${token}`
      );
    }
  }
});
