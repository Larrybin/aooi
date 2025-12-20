# P1：支付配置校验 + 运行时非静默 + 客户端显式反馈（含 requestId）

## 目标（已确认）

- P1-1：支付相关 JSON 配置在“保存阶段”做校验；运行时解析失败不要静默（至少告警 + 可理解错误）。
- P1-2：`stripe_payment_methods` 解析失败不应直接清空（校验/回退/告警组合）。
- P1-3：客户端关键 fetch 失败显式反馈，并尽量统一 requestId 展示。

## 约束

- 仅修改 `src/`（本计划文件除外）。
- 允许行为变化（校验失败会拒绝保存/checkout 可能返回 422）。

## 方案（选定：A）

1. 保存入口强校验：在 Admin Settings 的 Server Action 保存前校验并归一化。
2. 运行时兜底：
   - Stripe payment methods：解析失败回退到 `['card']` 并告警。
   - Creem product ids mapping：配置非空且无效时 checkout 返回 422，并记录告警日志。
3. 客户端关键请求：AppContext fetch 失败 toast 显示（含 requestId），避免静默失败。

## 执行步骤（原子化）

1. 新增校验工具
   - 文件：`src/shared/services/settings/validators/payment.ts`
   - 导出：
     - `parseStripePaymentMethodsConfig(value: string)`
     - `parseCreemProductIdsMappingConfig(value: string)`
2. Admin Settings 保存阶段校验
   - 文件：`src/app/[locale]/(admin)/admin/settings/[tab]/page.tsx`
   - 在 `handleSubmit` 内新增对 `stripe_payment_methods` 与 `creem_product_ids` 的校验，失败用 `actionErr(...)` 返回。
3. Stripe 运行时回退 + 告警
   - 文件：`src/shared/services/payment/manager.ts`
   - 解析失败不置空，改为回退 `['card']` 并 `logger.warn(...)`。
4. Creem mapping 运行时 422
   - 文件：`src/app/api/payment/checkout/route.ts`
   - 在 `getPaymentProductId` 中，当 `creem_product_ids` 非空但无效，`throw new UnprocessableEntityError(...)`。
5. 客户端显式反馈 + requestId
   - 文件：`src/shared/contexts/app.tsx`
   - 对 configs/userInfo/userCredits fetch 失败 toast 提示（含 requestId），并避免重复弹窗。

## 验收

- 保存 settings：
  - 非法 `stripe_payment_methods` / `creem_product_ids` 会被拒绝保存并提示原因。
- 运行时：
  - Stripe payment methods 解析失败时仍可支付（回退 card），且有告警日志。
  - Creem mapping 非空且无效时 checkout 返回 422，并带可理解信息（客户端 toast 带 requestId）。
- 客户端：
  - `get-configs/get-user-info/get-user-credits` 失败不再静默（toast + requestId）。

