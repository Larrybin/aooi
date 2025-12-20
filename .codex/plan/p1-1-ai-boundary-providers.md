# P1-1：AI 扩展边界污染（types 与 providers 混导出）

## 背景
- 文档来源：`docs/ROBUSTNESS_AUDIT.md`（P1-1）
- 问题：`src/extensions/ai/index.ts` 通过 `export * from './kie'` / `export * from './replicate'` 将 provider 实现与 types 同入口导出；client 组件只为拿 enum/type 也可能把 provider 依赖链带入。

## 目标
- 将 provider 实现从 `@/extensions/ai` 入口移出，避免 client/SSR 非预期引用风险。
- providers 入口显式 `server-only`，实现 fail-fast。
- 验收：`pnpm lint` + `pnpm build`

## 实施方案
- 新增 `src/extensions/ai/providers.ts`：
  - `import 'server-only'`
  - 仅导出 `KieProvider`、`ReplicateProvider`
- 修改 `src/extensions/ai/index.ts`：移除 `export * from './kie'`、`export * from './replicate'`
- 修改 `src/shared/services/ai.ts`：
  - `AIManager` 继续从 `@/extensions/ai` 引用
  - providers 改为从 `@/extensions/ai/providers` 引用

## 影响范围
- client 侧对 `@/extensions/ai` 的类型/枚举引用保持可用。
- server 侧装配 provider 的 import 路径会变更。
