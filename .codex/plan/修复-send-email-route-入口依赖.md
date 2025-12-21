# 修复 send-email route 的入口依赖（方案 2）

## 背景

`src/app/api/email/send-email/route.ts` 作为 Route Handler（server 入口）导入了 `@/shared/blocks/email/verification-code`（UI 层），触发 ESLint 架构边界的 fail-fast 约束：Route Handler 禁止依赖 UI 层（blocks/components/contexts/themes）。

## 目标

- 消除 `route.ts` 对 UI 层的依赖，恢复 `pnpm lint` 通过。
- 对外 API（route 行为、入参/出参）不变。

## 选定方案

方案 2：将邮件模板下沉到 `src/shared/content/email/**`（`server-only`），Route Handler 只做编排。

## 计划步骤

1. 新增 `src/shared/content/email/verification-code.tsx`
   - 文件顶部 `import 'server-only'`
   - 导出 `buildVerificationCodeEmailPayload(...)`，返回 `{ react: <.../> }`（不改变 subject/to 的归属）
2. 修改 `src/app/api/email/send-email/route.ts`
   - 移除对 `@/shared/blocks/email/verification-code` 的导入
   - 改为使用 `buildVerificationCodeEmailPayload` 生成 `react` payload
3. 运行 `pnpm lint` 验收

