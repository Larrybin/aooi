# P1-2：Payment 扩展边界污染（types 与 providers 混导出）

## 背景
- 文档来源：`docs/ROBUSTNESS_AUDIT.md`（P1-2）
- 问题：`src/extensions/payment/index.ts` 通过 `export * from './stripe' | './creem' | './paypal'` 将 provider 实现与类型同入口导出；页面/组件引用 `PaymentType` 等时，存在把 provider 依赖链带入 client/SSR 的风险。

## 目标
- provider 实现不再从 `@/extensions/payment` 入口导出。
- 新增 `@/extensions/payment/providers` 作为 server-only provider 入口（fail-fast）。
- 更新 server 侧装配引用。
- 验收：`pnpm lint` + `pnpm build` 通过。

## 实施方案
- 新增 `src/extensions/payment/providers.ts`：
  - `import 'server-only'`
  - 仅导出 `StripeProvider` / `CreemProvider` / `PayPalProvider`
- 修改 `src/extensions/payment/index.ts`：移除对 `./stripe` / `./creem` / `./paypal` 的 runtime re-export。
- 修改 `src/shared/services/payment/manager.ts`：
  - `PaymentManager` 继续从 `@/extensions/payment` 引用
  - providers 改为从 `@/extensions/payment/providers` 引用

## 文件清单
- 新增：`src/extensions/payment/providers.ts`
- 修改：`src/extensions/payment/index.ts`
- 修改：`src/shared/services/payment/manager.ts`
- 修改：`docs/ROBUSTNESS_AUDIT.md`（更新 P1-2 状态）

## 验收步骤
- `pnpm lint`
- `pnpm build`
