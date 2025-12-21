# P2 下一轮（范围 B）：清理页面 passby:any + 收敛 Creem remaining any（方案 1）

## 范围

- 页面层：移除各页面 `passby:any/_passby:any`（根因修复：避免把 `FormType` 泛型锁死）。
- 支付扩展：继续收敛 `src/extensions/payment/creem.ts` 的 remaining `any`，将外部输入边界收敛为 `unknown + 最小 Zod schema`。

## 约束

- 对外导出 API 不变。
- 失败策略：校验失败直接 fail-fast（webhook/外部 payload 不合格 => 明确异常）。
- 每段完成后验收：`pnpm lint` + `npx tsc --noEmit`。

## 计划步骤

### 线 1：页面 passby:any 清理
1. 将 `const form: FormType = { ... }` 改为 `const form = { ... } satisfies FormType`（保留结构校验、恢复 passby 推断）。
2. handler 参数不再使用 `any`：未使用 passby 则 `_passby: unknown` 或移除；使用 passby 则由推断类型提供约束。
3. 验收：`pnpm lint` + `npx tsc --noEmit`。

### 线 2：Creem remaining any 收敛
1. `safeFetchJson<any>` -> `safeFetchJson<unknown>`，并对返回做最小 schema 校验。
2. `session/invoice/subscription/product` 等入参 `any` -> `unknown`，入口 `safeParse` 校验必需字段。
3. 验收：`pnpm lint` + `npx tsc --noEmit`。

## 完成情况（已验收）

- 页面层：`passby:any/_passby:any` 已为 0（保持 `FormType` 结构校验，同时恢复泛型推断）。
- Creem：对外部 API 返回与 webhook payload 统一采用 `unknown + Zod.safeParse + .passthrough()` 的最小校验；不改变对外导出 API。
- 验收：`pnpm lint` + `npx tsc --noEmit` 均通过。

## 优化补充（不改行为）

- `src/extensions/payment/creem.ts`：抽出 `parseOrThrow()` 统一外部输入校验写法；将部分重复 schema parse 收敛为“先校验再传递已校验对象”（例如 checkout session -> subscription -> subscriptionInfo），减少重复与歧义。
- 仅做内部可读性/一致性优化：异常类型与文案保持原策略（fail-fast），对外导出 API 不变。

## 最佳实践对齐（Context7 摘要）

- Zod：推荐用 `safeParse()` 处理外部输入边界，避免散落 try/catch，并用 `.passthrough()` 保留未知字段（便于兼容 API 增量字段）。
- TypeScript：外部输入先视为 `unknown`，通过运行时检查/校验进行 narrowing，再进入业务逻辑（避免 `any` 扩散）。
