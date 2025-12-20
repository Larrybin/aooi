---
task: P0：ESLint 架构边界规则（保守演进）
mode: 执行计划存档
scope:
  include:
    - eslint.config.mjs
  exclude:
    - raphael-starterkit-v1-main/**
principles: [SOLID, KISS, DRY, YAGNI]
constraints:
  - 不引入新依赖
  - 仅做 lint 约束（不改业务逻辑）
  - 以“允许列表 + 明确例外”的方式防回归
acceptance:
  - pnpm lint
  - npx tsc --noEmit
---

## 目标（P0）

1) 收敛 UI 共享层对 `@/core/**` 的依赖面：仅允许 `@/core/i18n/navigation` 与 `@/core/auth/client`，其它 core 依赖一律禁止。

2) 禁止 `shared/models` 扩散对 docs/mdx 的耦合：默认禁止 `@/core/docs/**` 与 `@/mdx-components`，对 `src/shared/models/post.tsx` 作为已知历史热点暂时例外放行。

3) 禁止 runtime 误导入 drizzle-kit 配置：禁止在 `src/**` 导入 `@/core/db/config`（该模块仅用于 drizzle-kit CLI）。

## 实施方式

- 使用 ESLint flat config 的 `files` 匹配实现分目录规则。
- 使用 `no-restricted-imports` 的 `patterns.regex`/`patterns.group`/`paths` 实现禁止导入与错误提示。
- 例外通过更靠后的、文件级别的 `files` 覆盖实现（优先级更高）。

