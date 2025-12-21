# P2 批次 C+D：减少无意义 catch/throw、逐步收敛 any（方案 1）

## 目标

- 批次 C：清理“无意义 catch/throw”（例如仅 `catch { throw error }` 的纯转发）。
- 批次 D：
  - D-1：以支付 webhook（`creem/paypal`）的 `event:any` 为切入点，收敛为 `unknown + 最小 Zod schema`。
  - D-2：全仓将 `catch (e:any)` 收敛为 `catch (e:unknown)` 并用统一工具提取信息。
  - D-3：去掉可确定替换的 `as any`（logger/locale-detector 等）。

## 约束

- 不改变对外 API。
- 保持 fail-fast：webhook payload 不符合 schema 时抛明确错误（转为 4xx）。
- 每阶段验收：`pnpm lint` + `npx tsc --noEmit`。

## 步骤

1. 批次 C：移除 payment providers 内纯转发 try/catch（stripe/creem/paypal）。
2. 批次 D-1：为 creem/paypal webhook event 增加最小 Zod schema，`event:any` -> `unknown`。
3. 批次 D-2：将全仓 `catch (e:any)` -> `catch (e:unknown)`，统一用 `toErrorMessage()`。
4. 批次 D-3：去掉已知 `as any`（logger/locale-detector）。

