# P2：移除 @ts-ignore、清理 resp.ts、收敛 any（批次 A+B）

## 背景

需要对代码做 P2 质量治理：
- 移除 `@ts-ignore`
- 清理 `resp.ts`（统一为 `src/shared/lib/api/response.ts` 的 `jsonOk/jsonErr` 语义）
- 逐步减少无意义 catch/throw、收敛 `any`

本次仅执行批次 A+B（高确定性、低风险、可独立验收）。

## 约束

- 对外导出 API 不变（仅做内部实现与类型治理）。
- `resp.ts` 删除前必须确认全仓无引用点（含 `src` 外）。

## 事实核验

- `src/shared/lib/resp.ts`：全仓（含 `src` 外）扫描无引用点，只有文件自身命中。
- `@ts-ignore`：仅 1 处，位于 `src/shared/blocks/common/markdown-editor.tsx`，用于 `overtype` 类型缺失/不兼容。

## 计划

### 批次 A：删除 `resp.ts`
1. 删除 `src/shared/lib/resp.ts`
2. 验收：`pnpm lint`、`npx tsc --noEmit`

### 批次 B：移除 `@ts-ignore`（overtype 最小声明）
1. 新增 `src/shared/types/overtype.d.ts`，补齐最小使用面类型（`OverType.init`/实例方法）
2. 修改 `src/shared/blocks/common/markdown-editor.tsx`，移除 `// @ts-ignore`
3. 验收：`pnpm lint`、`npx tsc --noEmit`

