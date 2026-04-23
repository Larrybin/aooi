# Site Migration Inventory

对应设计文档：
[bin-arch-big-bang-convergence-v2-3-design-20260422-173805.md](/Users/bin/.gstack/projects/Larrybin-aooi/bin-arch-big-bang-convergence-v2-3-design-20260422-173805.md)

## Goal

把当前仓库的运行时输入明确拆成三类，并持续收口到单向依赖：

1. `site identity`
2. `runtime binding`
3. `runtime settings`

这份清单只记录当前真实状态，不保留已经完成但过时的施工计划。

## Current Status

### 已完成

#### Phase 1: `@/site` 主干切换

- 显式站点目录已建立：
  - [sites/dev-local/site.config.json](/Users/bin/Desktop/project/aooi/sites/dev-local/site.config.json)
  - [sites/mamamiya/site.config.json](/Users/bin/Desktop/project/aooi/sites/mamamiya/site.config.json)
- `@/site` 已成为运行时唯一站点入口：
  - [scripts/site-schema.mjs](/Users/bin/Desktop/project/aooi/scripts/site-schema.mjs)
  - [scripts/generate-site-module.mjs](/Users/bin/Desktop/project/aooi/scripts/generate-site-module.mjs)
  - [scripts/run-with-site.mjs](/Users/bin/Desktop/project/aooi/scripts/run-with-site.mjs)
  - [src/infra/platform/site.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/site.ts)
  - [tests/site-module.test.ts](/Users/bin/Desktop/project/aooi/tests/site-module.test.ts)
- brand / canonical / auth origin 已切到 `@/site`：
  - [src/infra/platform/brand/placeholders.server.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/brand/placeholders.server.ts)
  - [src/infra/url/canonical.ts](/Users/bin/Desktop/project/aooi/src/infra/url/canonical.ts)
  - [src/config/server-auth-base-url.ts](/Users/bin/Desktop/project/aooi/src/config/server-auth-base-url.ts)
  - [src/infra/platform/auth/runtime-origin.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/auth/runtime-origin.ts)

#### Phase 1.5: Identity Direction Lock

- 生产语义命令已要求显式 `SITE`，不再使用隐式 production fallback：
  - [scripts/run-with-site.mjs](/Users/bin/Desktop/project/aooi/scripts/run-with-site.mjs)
- Cloudflare 生成链路已经是 `site -> generated artifact` 单向：
  - [scripts/create-cf-wrangler-config.mjs](/Users/bin/Desktop/project/aooi/scripts/create-cf-wrangler-config.mjs)
  - [scripts/check-cloudflare-config.mjs](/Users/bin/Desktop/project/aooi/scripts/check-cloudflare-config.mjs)
  - [tests/smoke/check-cloudflare-config.test.ts](/Users/bin/Desktop/project/aooi/tests/smoke/check-cloudflare-config.test.ts)
- 部署 / smoke 脚本不再通过 `NEXT_PUBLIC_APP_URL` 或 wrangler 内容反推 identity：
  - [src/architecture-boundaries.test.ts](/Users/bin/Desktop/project/aooi/src/architecture-boundaries.test.ts)

#### Batch 2: Typed Runtime Settings + Secret Boundary

- `settings-runtime` 已拆成 typed contracts、builders、typed readers：
  - [src/domains/settings/application/settings-runtime.contracts.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/application/settings-runtime.contracts.ts)
  - [src/domains/settings/application/settings-runtime.builders.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/application/settings-runtime.builders.ts)
  - [src/domains/settings/application/settings-runtime.query.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/application/settings-runtime.query.ts)
- 公开 UI 配置已收敛为 `PublicUiConfig`，旧 `public-config.view.ts` 已删除：
  - [src/domains/settings/application/public-config-projection.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/application/public-config-projection.ts)
  - [src/app/api/config/get-configs/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/config/get-configs/route.ts)
  - [src/app/api/config/get-configs/route-logic.ts](/Users/bin/Desktop/project/aooi/src/app/api/config/get-configs/route-logic.ts)
- auth 已拆成 UI settings + server bindings：
  - [src/infra/platform/auth/config.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/auth/config.ts)
  - [src/infra/platform/auth/client.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/auth/client.ts)
  - [src/infra/platform/auth/server-bindings.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/auth/server-bindings.ts)
- payment 已拆成 `BillingRuntimeSettings + PaymentRuntimeBindings` 双输入：
  - [src/infra/adapters/payment/service.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/payment/service.ts)
  - [src/infra/adapters/payment/runtime-bindings.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/payment/runtime-bindings.ts)
  - [src/app/api/payment/checkout/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/payment/checkout/route.ts)
  - [src/app/api/payment/notify/[provider]/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/payment/notify/%5Bprovider%5D/route.ts)
  - [src/domains/billing/application/payment-callback.ts](/Users/bin/Desktop/project/aooi/src/domains/billing/application/payment-callback.ts)
- AI 已拆成 gating settings + provider bindings：
  - [src/domains/ai/application/capabilities.ts](/Users/bin/Desktop/project/aooi/src/domains/ai/application/capabilities.ts)
  - [src/domains/ai/application/service.ts](/Users/bin/Desktop/project/aooi/src/domains/ai/application/service.ts)
  - [src/domains/ai/application/provider-bindings.ts](/Users/bin/Desktop/project/aooi/src/domains/ai/application/provider-bindings.ts)
- storage 已完成 `binding-only` 收口，并显式拒绝旧 configs 形态：
  - [src/infra/adapters/storage/service-builder.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/storage/service-builder.ts)
  - [src/shared/platform/cloudflare/storage.ts](/Users/bin/Desktop/project/aooi/src/shared/platform/cloudflare/storage.ts)
- settings registry 中的 auth / payment / AI secret keys 已移除：
  - [src/domains/settings/registry.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/registry.ts)
  - [src/domains/settings/registry.test.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/registry.test.ts)
- 架构防回退规则已建立：
  - [dependency-cruiser.cjs](/Users/bin/Desktop/project/aooi/dependency-cruiser.cjs)
  - [src/architecture-boundaries.test.ts](/Users/bin/Desktop/project/aooi/src/architecture-boundaries.test.ts)

### 未完成

- content 仍然主要来自仓库级 `content/**`，没有切到 `sites/<site>/content`
- Cloudflare bindings 仍然是“模板 + 当前 site 注入”，还不是“每个 site 自带完整 deploy manifest”
- stateful Cloudflare resource naming 仍未进入 site-scoped contract
- payment / Cloudflare site instance contract 还没有按 site 独立编排
- 仓库中仍有一批 raw settings consumers 没迁到 typed subsets，只是已经不再承载 identity / secret 主线

## Classification

### A. Site Identity

定义：进 repo、build-time 决定、描述“这个站是什么”。

#### Canonical sources

- [sites/dev-local/site.config.json](/Users/bin/Desktop/project/aooi/sites/dev-local/site.config.json)
- [sites/mamamiya/site.config.json](/Users/bin/Desktop/project/aooi/sites/mamamiya/site.config.json)
- [scripts/site-schema.mjs](/Users/bin/Desktop/project/aooi/scripts/site-schema.mjs)
- [scripts/generate-site-module.mjs](/Users/bin/Desktop/project/aooi/scripts/generate-site-module.mjs)
- [src/infra/platform/site.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/site.ts)

#### Current identity consumers

- Brand / placeholders
  - [src/infra/platform/brand/placeholders.server.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/brand/placeholders.server.ts)
  - [src/infra/platform/brand/placeholders-react.server.tsx](/Users/bin/Desktop/project/aooi/src/infra/platform/brand/placeholders-react.server.tsx)
- Canonical / metadata / robots / sitemap
  - [src/infra/url/canonical.ts](/Users/bin/Desktop/project/aooi/src/infra/url/canonical.ts)
  - [src/app/robots.ts](/Users/bin/Desktop/project/aooi/src/app/robots.ts)
  - [src/app/sitemap.ts](/Users/bin/Desktop/project/aooi/src/app/sitemap.ts)
  - [src/surfaces/public/seo/metadata.ts](/Users/bin/Desktop/project/aooi/src/surfaces/public/seo/metadata.ts)
- Auth origin / base URL
  - [src/config/server-auth-base-url.ts](/Users/bin/Desktop/project/aooi/src/config/server-auth-base-url.ts)
  - [src/infra/platform/auth/runtime-origin.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/auth/runtime-origin.ts)
- Billing callback URL / checkout metadata
  - [src/domains/billing/application/checkout.ts](/Users/bin/Desktop/project/aooi/src/domains/billing/application/checkout.ts)
  - [src/domains/billing/application/payment-callback.ts](/Users/bin/Desktop/project/aooi/src/domains/billing/application/payment-callback.ts)
- Shared UI identity 展示
  - [src/shared/blocks/common/app-image.tsx](/Users/bin/Desktop/project/aooi/src/shared/blocks/common/app-image.tsx)
  - [src/shared/blocks/common/copyright.tsx](/Users/bin/Desktop/project/aooi/src/shared/blocks/common/copyright.tsx)
  - [src/shared/lib/api/csrf.server.ts](/Users/bin/Desktop/project/aooi/src/shared/lib/api/csrf.server.ts)

#### Remaining risks

- 仍需防止后续把 `site.brand.*` 混回 settings/public facade
- deploy 维度还不是完整的 site instance contract

### B. Runtime Binding

定义：来自 env / secrets / Cloudflare bindings / deploy target，描述“这个站如何运行”。

#### Current bindings

- Auth server bindings
  - [src/infra/platform/auth/server-bindings.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/auth/server-bindings.ts)
  - [src/config/env-contract.ts](/Users/bin/Desktop/project/aooi/src/config/env-contract.ts)
- Payment runtime bindings
  - [src/infra/adapters/payment/runtime-bindings.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/payment/runtime-bindings.ts)
  - [src/config/env-contract.ts](/Users/bin/Desktop/project/aooi/src/config/env-contract.ts)
- AI provider bindings
  - [src/domains/ai/application/provider-bindings.ts](/Users/bin/Desktop/project/aooi/src/domains/ai/application/provider-bindings.ts)
  - [src/config/env-contract.ts](/Users/bin/Desktop/project/aooi/src/config/env-contract.ts)
- Storage runtime bindings
  - [src/infra/adapters/storage/service-builder.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/storage/service-builder.ts)
  - [src/shared/lib/storage-public-url.ts](/Users/bin/Desktop/project/aooi/src/shared/lib/storage-public-url.ts)
  - [src/shared/platform/cloudflare/storage.ts](/Users/bin/Desktop/project/aooi/src/shared/platform/cloudflare/storage.ts)
- Cloudflare generated deploy config
  - [scripts/create-cf-wrangler-config.mjs](/Users/bin/Desktop/project/aooi/scripts/create-cf-wrangler-config.mjs)
  - [scripts/check-cloudflare-config.mjs](/Users/bin/Desktop/project/aooi/scripts/check-cloudflare-config.mjs)
  - [scripts/run-cf-app-deploy.mjs](/Users/bin/Desktop/project/aooi/scripts/run-cf-app-deploy.mjs)
  - [scripts/run-cf-state-deploy.mjs](/Users/bin/Desktop/project/aooi/scripts/run-cf-state-deploy.mjs)
  - [scripts/run-cf-multi-build-check.mjs](/Users/bin/Desktop/project/aooi/scripts/run-cf-multi-build-check.mjs)
  - [sites/dev-local/deploy.settings.json](/Users/bin/Desktop/project/aooi/sites/dev-local/deploy.settings.json)
  - [sites/mamamiya/deploy.settings.json](/Users/bin/Desktop/project/aooi/sites/mamamiya/deploy.settings.json)
- Wrangler templates
  - [wrangler.cloudflare.toml](/Users/bin/Desktop/project/aooi/wrangler.cloudflare.toml)
  - [cloudflare/wrangler.state.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.state.toml)
  - [cloudflare/wrangler.server-public-web.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-public-web.toml)
  - [cloudflare/wrangler.server-auth.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-auth.toml)
  - [cloudflare/wrangler.server-payment.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-payment.toml)
  - [cloudflare/wrangler.server-member.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-member.toml)
  - [cloudflare/wrangler.server-chat.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-chat.toml)
  - [cloudflare/wrangler.server-admin.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-admin.toml)

#### Remaining risks

- wrangler 仍然是模板驱动，不是每个 site 自带完整 deploy manifest
- Cloudflare stateful bindings 仍未做 site-scoped 命名生成
- site 级 deploy/resource contract 还没有完全平台化，但 capability requirements 已收口到 `sites/<site>/deploy.settings.json`

### C. Runtime Settings

定义：站点上线后可在后台修改，描述“这个站当前怎么配置”。

#### Current typed settings boundary

- Typed contracts
  - [src/domains/settings/application/settings-runtime.contracts.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/application/settings-runtime.contracts.ts)
- Non-secret builders
  - [src/domains/settings/application/settings-runtime.builders.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/application/settings-runtime.builders.ts)
- Typed readers
  - [src/domains/settings/application/settings-runtime.query.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/application/settings-runtime.query.ts)
- Raw settings store
  - [src/domains/settings/application/settings-store.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/application/settings-store.ts)
- Registry / definitions
  - [src/domains/settings/registry.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/registry.ts)

#### Current typed consumers

- Public UI / layout / page / config route
  - [src/themes/default/layouts/landing.tsx](/Users/bin/Desktop/project/aooi/src/themes/default/layouts/landing.tsx)
  - [src/themes/default/layouts/landing-marketing.tsx](/Users/bin/Desktop/project/aooi/src/themes/default/layouts/landing-marketing.tsx)
  - [src/app/api/config/get-configs/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/config/get-configs/route.ts)
  - [src/app/[locale]/(docs)/layout.tsx](/Users/bin/Desktop/project/aooi/src/app/%5Blocale%5D/(docs)/layout.tsx)
  - [src/app/[locale]/(auth)/layout.tsx](/Users/bin/Desktop/project/aooi/src/app/%5Blocale%5D/(auth)/layout.tsx)
  - [src/app/[locale]/(chat)/layout.tsx](/Users/bin/Desktop/project/aooi/src/app/%5Blocale%5D/(chat)/layout.tsx)
- Auth UI / auth server config
  - [src/infra/platform/auth/config.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/auth/config.ts)
  - [src/infra/platform/auth/client.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/auth/client.ts)
  - [src/shared/contexts/app.tsx](/Users/bin/Desktop/project/aooi/src/shared/contexts/app.tsx)
- Billing / payment
  - [src/app/api/payment/checkout/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/payment/checkout/route.ts)
  - [src/app/api/payment/notify/[provider]/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/payment/notify/%5Bprovider%5D/route.ts)
  - [src/domains/billing/application/member-billing.actions.ts](/Users/bin/Desktop/project/aooi/src/domains/billing/application/member-billing.actions.ts)
  - [src/domains/billing/application/payment-callback.ts](/Users/bin/Desktop/project/aooi/src/domains/billing/application/payment-callback.ts)
- AI capability / service / routes
  - [src/domains/ai/application/capabilities.ts](/Users/bin/Desktop/project/aooi/src/domains/ai/application/capabilities.ts)
  - [src/domains/ai/application/service.ts](/Users/bin/Desktop/project/aooi/src/domains/ai/application/service.ts)
  - [src/app/api/ai/generate/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/ai/generate/route.ts)
  - [src/app/api/chat/deps.ts](/Users/bin/Desktop/project/aooi/src/app/api/chat/deps.ts)

#### Remaining raw settings consumers

这些路径仍然直接读取 `settings-store` 或直接消费 `Configs`，但已经不再承载 site identity / secret boundary 主线：

- Root layout 的 analytics / affiliate / customer service 聚合
  - [src/app/layout.tsx](/Users/bin/Desktop/project/aooi/src/app/layout.tsx)
  - [src/infra/adapters/analytics/service.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/analytics/service.ts)
  - [src/infra/adapters/affiliate/service.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/affiliate/service.ts)
  - [src/infra/adapters/customer-service/service.tsx](/Users/bin/Desktop/project/aooi/src/infra/adapters/customer-service/service.tsx)
- Email provider runtime
  - [src/infra/adapters/email/service.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/email/service.ts)
- Ads / ads.txt
  - [src/infra/adapters/ads/service.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/ads/service.ts)
  - [src/app/ads.txt/route.ts](/Users/bin/Desktop/project/aooi/src/app/ads.txt/route.ts)
- Admin settings 页面本身
  - [src/app/[locale]/(admin)/admin/settings/[tab]/page.tsx](/Users/bin/Desktop/project/aooi/src/app/%5Blocale%5D/(admin)/admin/settings/%5Btab%5D/page.tsx)

#### Remaining risks

- `settings-store` 仍然是若干非关键能力的 raw source bus
- ads / analytics / affiliate / customer service / email 还没有迁到 typed subsets
- `settings-store` 仍保留 `Configs = Record<string, string>` 作为底层存储表示，但不应再次向业务层扩散

## Batch Status

### Batch 2

已完成，不再以“计划”状态存在。

完成判定：

- 不再有旧 `readRuntimeSettings*` facade
- 不再有旧 `getPublicConfigs*` facade
- payment 已收口为结构化双输入
- storage 已收口为 `binding-only`
- auth / payment / AI secrets 已从 settings registry 移出

### Batch 3: Site-driven Build / Deploy Contract

未完成。

目标：

- 新增一个 site 时，不需要手改现有单站命名
- wrangler / deploy / smoke 输入都由当前 site 派生
- stateful bindings 命名进入 site-scoped contract

主要文件：

- [package.json](/Users/bin/Desktop/project/aooi/package.json)
- [scripts/run-with-site.mjs](/Users/bin/Desktop/project/aooi/scripts/run-with-site.mjs)
- [scripts/create-cf-wrangler-config.mjs](/Users/bin/Desktop/project/aooi/scripts/create-cf-wrangler-config.mjs)
- [scripts/check-cloudflare-config.mjs](/Users/bin/Desktop/project/aooi/scripts/check-cloudflare-config.mjs)
- [scripts/run-cf-app-deploy.mjs](/Users/bin/Desktop/project/aooi/scripts/run-cf-app-deploy.mjs)
- [scripts/run-cf-state-deploy.mjs](/Users/bin/Desktop/project/aooi/scripts/run-cf-state-deploy.mjs)
- [scripts/run-cf-multi-build-check.mjs](/Users/bin/Desktop/project/aooi/scripts/run-cf-multi-build-check.mjs)
- [wrangler.cloudflare.toml](/Users/bin/Desktop/project/aooi/wrangler.cloudflare.toml)
- [cloudflare/wrangler.state.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.state.toml)
- [cloudflare/wrangler.server-public-web.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-public-web.toml)
- [cloudflare/wrangler.server-auth.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-auth.toml)
- [cloudflare/wrangler.server-payment.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-payment.toml)
- [cloudflare/wrangler.server-member.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-member.toml)
- [cloudflare/wrangler.server-chat.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-chat.toml)
- [cloudflare/wrangler.server-admin.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.server-admin.toml)

### Batch 4: Site-scoped Content Source

未开始。

目标：

- 文档、博客、page 内容都可以按 site 独立
- 仓库不再默认只有一套 docs/blog/page 内容

主要文件：

- [src/domains/content/infra/source.ts](/Users/bin/Desktop/project/aooi/src/domains/content/infra/source.ts)
- [src/domains/content/application/docs-content.query.ts](/Users/bin/Desktop/project/aooi/src/domains/content/application/docs-content.query.ts)
- [src/domains/content/application/public-content.query.ts](/Users/bin/Desktop/project/aooi/src/domains/content/application/public-content.query.ts)
- [src/domains/content/application/local-content.tsx](/Users/bin/Desktop/project/aooi/src/domains/content/application/local-content.tsx)
- [src/app/api/docs/search/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/docs/search/route.ts)
- [content/docs/**](/Users/bin/Desktop/project/aooi/content/docs)
- [content/pages/**](/Users/bin/Desktop/project/aooi/content/pages)

### Batch 5: Payment / Cloudflare Site Instance Contract

未开始。

目标：

- provider 初始化不再依赖单站全局假设
- webhook / callback / secret / binding 都可以按 site 独立编排
- 删除任一 site 的支付或状态资源，不影响其他站

主要文件：

- [src/domains/billing/application/checkout.ts](/Users/bin/Desktop/project/aooi/src/domains/billing/application/checkout.ts)
- [src/domains/billing/application/payment-callback.ts](/Users/bin/Desktop/project/aooi/src/domains/billing/application/payment-callback.ts)
- [src/app/api/payment/notify/[provider]/route.ts](/Users/bin/Desktop/project/aooi/src/app/api/payment/notify/%5Bprovider%5D/route.ts)
- [src/infra/adapters/payment/service.ts](/Users/bin/Desktop/project/aooi/src/infra/adapters/payment/service.ts)
- [cloudflare/wrangler.state.toml](/Users/bin/Desktop/project/aooi/cloudflare/wrangler.state.toml)
- [src/shared/platform/cloudflare/stateful-limiters.ts](/Users/bin/Desktop/project/aooi/src/shared/platform/cloudflare/stateful-limiters.ts)
- [src/shared/platform/cloudflare/storage.ts](/Users/bin/Desktop/project/aooi/src/shared/platform/cloudflare/storage.ts)
