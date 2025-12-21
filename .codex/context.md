# 项目画像
- 生成时间：2025-12-21 16:39:00
- 根目录：D:/Cursor project/shipany-template-two
- Git：main @ 70a6d4d（dirty=是）

## Codex 工作流配置（可选）
- 配置文件：codex-workflow.config.json
- schemaVersion：1
- riskGate.mode：hard
- riskGate.useBuiltins：是
- riskGate.validationScripts：format:check, lint, build

## 工具链
- 包管理器：pnpm
- 锁文件：pnpm-lock.yaml

## 关键依赖版本（抽样）
- next：16.0.7
- react：19.2.0
- react-dom：19.2.0
- typescript：^5
- eslint：^9.37.0
- prettier：^3.6.2

## scripts（抽样）
- build：node scripts/next-build.mjs
- build:fast：node scripts/next-build.mjs --max-old-space-size=4096
- dev：next dev --turbopack
- format：prettier --write .
- format:check：prettier --check .
- lint：eslint .
- start：next start

## 目录结构（关键路径）
- src/app：是
- src/core：是
- src/shared：是
- src/themes：是
- docs：是
- content：是
- public：是
- scripts：是

## 关键配置文件
- next.config.mjs
- eslint.config.mjs
- tsconfig.json
- .prettierrc.json
- .env.example

## TypeScript（摘要）
- strict：是

## ESLint 边界护栏（摘要）
- 配置文件：eslint.config.mjs
- 依赖方向与边界通过 `no-restricted-imports` 规则固化（以 eslint 配置为准）。
- Client 模块禁止导入 `next/headers`（Server-only API）。
- Client 模块禁止导入 `server-only` 标记。
- Client 模块禁止导入 `@/core/db/**`（DB 访问必须 server-only）。
- shared UI 层仅允许依赖 `@/core/i18n/navigation` 与 `@/core/auth/client`（其余 core 依赖禁止）。
- `src/shared/content/**` 必须保持 server-only，禁止依赖 UI/client 层。
- `src/app/**/route.ts` 禁止依赖 UI 层（blocks/components/contexts/themes）。

## AGENTS.md（约束线索）
- AGENTS.md

## 工程文档入口（约定/审查）
- docs/CONVENTIONS.md
- docs/architecture/shared-layering.md
- docs/CODE_REVIEW.md
- docs/ARCHITECTURE_REVIEW.md
- content/docs/logging-conventions.zh.mdx
- content/docs/code-review-checklist.zh.mdx
