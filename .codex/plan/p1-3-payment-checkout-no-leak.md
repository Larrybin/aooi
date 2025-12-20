# P1-3：payment checkout 错误不泄漏内部细节（方案 1）

## 背景
- 文档来源：`docs/ROBUSTNESS_AUDIT.md`（P1-3）
- 问题：`src/app/api/payment/checkout/route.ts` 在 `catch` 中使用 `jsonErr(500, 'checkout failed: ' + message)`，会把内部异常 message 回传到客户端。

## 目标
- 不向客户端泄漏内部异常 message。
- 保持 server 端可观测性（requestId + 日志）。
- 验收：`pnpm lint` + `pnpm build` 通过。

## 实施方案（采用）
- 在 `checkout` 的 `catch` 内：
  - 仍然回写订单状态为失败（保持现有业务语义）。
  - 使用 request logger `log.error(...)` 记录原始 error 和关键上下文字段。
  - 对外不拼接异常 message；改为 `throw new Error('checkout failed')`，交给 `withApi()` 统一转换为 500，并附带 `x-request-id`。

## 影响范围
- 仅影响 checkout 失败时的对外错误文案与 HTTP 返回（不再返回内部 message）。
- 成功返回不变。

## 文件清单
- 修改：`src/app/api/payment/checkout/route.ts`
- 修改：`docs/ROBUSTNESS_AUDIT.md`（更新 P1-3 状态）

## 验收步骤
- `pnpm lint`
- `pnpm build`
