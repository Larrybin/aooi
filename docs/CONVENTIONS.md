# 既有约定与代码模式索引（Conventions Index）

本文件用于把仓库中“分散的约束、约定、模式样本”集中成一个可检索入口，方便人类与 AI 在做决策时快速定位权威来源与同类实现。

原则：**本文件是索引，不是大全**；规则以“可执行的护栏/真实代码”为准。本文件只负责指路与降低遗漏。

## 使用方式（推荐顺序）

1. 先读本文件，找到与你任务最接近的主题与样本入口。
2. 打开对应的“单一事实来源”（例如 `eslint.config.mjs`、`docs/architecture/shared-layering.md`）确认硬约束。
3. 选 3–5 个同类样本文件核对实现细节（命名、导出、错误处理、依赖方向）。
4. 发生冲突或需要偏离既有模式时，必须在 `.codex/plan/<任务名>.md` 记录取舍依据与验证方式。

## 最佳实践来源优先级与冲突处理

决策取证优先级（从高到低）：

1. 仓库既有约定与代码模式（同类模块的现有实现、目录结构、命名、错误处理、日志、测试方式）
2. `AGENTS.md` 约束（含更近作用域的 `AGENTS.md`）
3. 官方文档与权威资料（需要时用 Context7 查询并对齐版本）
4. 经验推断（必须标注为推断，并尽量给出可验证替代方案）

冲突记录模板（写入 `.codex/plan/<任务名>.md`）：

```md
- 冲突点：<描述>
  - 方案 A（来源）：...
  - 方案 B（来源）：...
  - 最终选择：...
  - 取舍依据：<一致性/风险/可维护性/性能/交付周期/约束>
  - 验证方式：<如何证明选择不会破坏目标>
```

## 单一事实来源（优先查这里）

| 主题                         | 单一事实来源                                | 说明                                                                        |
| ---------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| Server/Client 边界、依赖方向 | `eslint.config.mjs`                         | 以 lint 规则固化边界，避免口头约定（见 `docs/CODE_REVIEW.md`）。            |
| `src/shared` 分层约定        | `docs/architecture/shared-layering.md`      | 规定 `shared/models`/`shared/content`/`shared/services`/UI 层边界与禁依赖。 |
| Code Review 基线             | `docs/CODE_REVIEW.md`                       | PR 审查顺序与常见坑，含大量场景化示例。                                     |
| 架构审计与关键约束说明       | `docs/ARCHITECTURE_REVIEW.md`               | 解释为什么这么分层/这么约束（便于理解“为什么”）。                           |
| Logging 约定                 | `content/docs/logging-conventions.zh.mdx`   | 结构化日志字段/规范等。                                                     |
| PR Checklist                 | `content/docs/code-review-checklist.zh.mdx` | 面向 PR 的快速清单。                                                        |
| 认证                         | `docs/guides/auth.md`                       | Better Auth 使用方式与边界。                                                |
| RBAC                         | `docs/guides/rbac.md`                       | 角色/权限建模与初始化脚本。                                                 |
| 支付                         | `docs/guides/payment.md`                    | 支付接入、回调、幂等等关键路径。                                            |
| 数据库                       | `docs/guides/database.md`                   | Drizzle schema 与迁移流程。                                                 |

## 模式样本索引（按主题找入口）

### SEO / Metadata（Next.js App Router）

- 元数据 helper：`src/shared/lib/seo.ts`
- 使用 helper 的页面示例：`src/app/[locale]/(landing)/blog/page.tsx`、`src/app/[locale]/(landing)/pricing/page.tsx`
- 手写 `generateMetadata` 的页面示例：`src/app/[locale]/(auth)/sign-in/page.tsx`、`src/app/[locale]/(auth)/sign-up/page.tsx`

### Route Handlers（`src/app/**/route.ts`）

约定：入口只做编排（鉴权/校验/调用 services/返回响应），避免引入 UI 依赖图；具体护栏见 `eslint.config.mjs` 与 `docs/architecture/shared-layering.md`。

- 支付 checkout：`src/app/api/payment/checkout/route.ts`
- 支付回调/通知：`src/app/api/payment/notify/[provider]/route.ts`

### 错误处理（API / Server Actions）

- 公共错误类型：`src/shared/lib/errors.ts`（`BusinessError` / `ExternalError`）
- API：`src/shared/lib/api/errors.ts`、`src/shared/lib/api/route.ts`（`ApiError` / `withApi()`）
- Server Actions：`src/shared/lib/action/errors.ts`、`src/shared/lib/action/with-action.ts`（`ActionError` / `withAction()`）
- API 约定文档：`docs/api/reference.md`

### 支付集成（extensions）

- Provider 适配：`src/extensions/payment/creem.ts`、`src/extensions/payment/paypal.ts`、`src/extensions/payment/stripe.ts`
- Provider Adapter（校验/映射）：`src/extensions/payment/adapter.ts`
- 统一接口与类型：`src/extensions/payment/index.ts`
- Providers server-only 入口：`src/extensions/payment/providers.ts`（避免 provider 实现被 Client 侧误导入）

### Email / Storage 集成（extensions）

- Email：统一接口与类型 `src/extensions/email/index.ts`；Providers server-only 入口 `src/extensions/email/providers.ts`
- Storage：统一接口与类型 `src/extensions/storage/index.ts`；Providers server-only 入口 `src/extensions/storage/providers.ts`

### 数据库与迁移（Drizzle）

- Schema：`src/config/db/schema.ts`
- 迁移：`src/config/db/migrations/**`

### `src/shared` 分层（边界与示例入口）

以 `docs/architecture/shared-layering.md` 为准；当不确定放哪层时，优先对照该文件的“允许/禁止依赖”。

- 纯工具/一致性逻辑：`src/shared/lib/**`（示例：`src/shared/lib/seo.ts`）
- 叶子常量层：`src/shared/constants/**`（示例：`src/shared/constants/rbac-permissions.ts`）
- DAL/Repo/Facade：`src/shared/models/**`
- Content pipeline（server-only）：`src/shared/content/**`
- 服务装配（server-only）：`src/shared/services/**`
- UI 共享层：`src/shared/blocks/**`、`src/shared/components/**`、`src/shared/contexts/**`、`src/shared/hooks/**`

## 更新触发条件（保持索引不过期）

以下变更应同步更新本文件（只需新增/调整索引入口，不要复制整段规则）：

- 可选脚本：先运行 `pnpm conventions:draft` 生成 `.codex/drafts/CONVENTIONS.generated.md` 作为对照草案；提交前可运行 `pnpm conventions:check` 校验文档内引用路径有效性。
- 新增一个“跨模块可复用”的模式（例如：新的一套错误结构、日志字段、SEO 组装方式）。
- 调整依赖边界、Server/Client 划分、或新增 lint 护栏。
- 引入新的关键域（auth/billing/db/payment 等）或替换集成方案。
- 新增/更改关键脚本与工作流入口（`scripts/`、`package.json scripts`）。

# 构建与网络（字体）

为保证 `pnpm build` 可在受限网络环境下可重复执行，本仓库不使用 `next/font/google`（其会在构建期拉取 Google Fonts）。字体回退由 `src/config/style/theme.css` 的 `--font-*` 变量与系统字体栈提供。

如确实需要固定字体且避免构建期外网依赖，建议引入可 vendoring 的字体方案（例如 `@fontsource/*` 或自托管字体文件）并在 CSS 中引用。
