---
title: 修复 hydration mismatch（SignUser/AppContext）
date: 2025-12-16
---

## 背景/问题

- Next.js 开发环境出现 `Hydration failed because the server rendered HTML didn't match the client`。
- Diff 指向 `SignUser`：SSR 首屏渲染为 loading（`Loader2`），CSR 首屏渲染为登录按钮，导致 hydration mismatch 并触发整棵树在客户端重建。

## 根因

- `src/shared/contexts/app.tsx` 在 Client Component 的 SSR 预渲染阶段使用 `envConfigs.auth_secret` 初始化 `isCheckSign`：
  - 服务器端：`AUTH_SECRET` 存在 → `isCheckSign=true` → 渲染 loading。
  - 客户端：非 `NEXT_PUBLIC_*` 环境变量在客户端 bundle 中为 `''/undefined` → `isCheckSign=false` → 渲染登录按钮。
- 同一组件在 SSR/CSR 首屏输出不同分支，触发 hydration mismatch。

## 最佳实践参考（Context7）

- React 官方建议：若需要 SSR/CSR 渲染不同内容，使用“两段渲染”——首屏渲染与 SSR 保持一致，hydrate 后通过 `useEffect` 更新到客户端状态（必要时可使用 `suppressHydrationWarning` 作为兜底，但不建议滥用）。
- Next.js 建议：让依赖客户端状态的 UI 保持“可预测的服务端 fallback”，将变化隔离到小范围并在 mount 后更新。

## 执行计划（原子步骤）

1. 定位造成 SSR/CSR 初始状态差异的状态源（`envConfigs.auth_secret`）。
2. 将 `isCheckSign` 初始值改为 SSR/CSR 均一致的常量（稳定 fallback）。
3. 继续通过 `useSession().isPending` 在 hydrate 后同步真实状态。
4. 运行 `pnpm lint`、`pnpm build` 验证无类型/构建回归。

## 结果

- `isCheckSign` 首屏稳定为 `true`，SSR 与 CSR 初始 DOM 一致；hydrate 后再根据 `isPending` 切换 UI，避免 hydration mismatch。

## 追加发现：ThemeToggler 的 hydration mismatch

- 控制台出现 `toggle-group.tsx` 的 hydration mismatch（`data-state`/`aria-checked` 在 SSR/CSR 不一致）。
- 根因：`next-themes` 无法在 SSR 确定 `theme`，`useTheme()` 在服务端/挂载前返回值不稳定；而 Theme toggling UI（Radix ToggleGroup/图标）在首屏依赖该值，导致 SSR/CSR 选中态不同。
- 处理：按 `next-themes` 官方 “Avoid Hydration Mismatch” 建议，在组件 mounted 前渲染占位（SSR/CSR 首屏一致），mounted 后再渲染真实 ToggleGroup/图标。
