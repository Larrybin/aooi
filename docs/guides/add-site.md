# Add Site Runbook

这份文档说明如何在当前单仓多 site 架构中新增一个 site instance。

这里的 site 不是新的 Next.js route，也不是新的部署分支。一个 site 的最小事实源由三部分组成：

- `sites/<site-key>/site.config.json`：site identity，描述“这个站是什么”
- `sites/<site-key>/deploy.settings.json`：runtime binding contract，描述“这个站如何部署和运行”
- `sites/<site-key>/content/**`：site-scoped docs / pages / posts 内容

运行时只能通过生成的 `@/site` 读取站点身份。所有有生产语义的命令必须显式传 `SITE=<site-key>`。

## 1. Choose The Site Key

先确定唯一的 `site-key`，例如：

```text
my-site
```

`site-key` 必须同时满足：

- 目录名是 `sites/my-site`
- `sites/my-site/site.config.json` 里的 `key` 是 `my-site`
- 本地、测试、构建、部署命令都使用 `SITE=my-site`

不要新增 alias、fallback、站点名映射表或兼容层。目录名、配置 key、命令参数必须直接一致。

## 2. Create The Site Directory

新增目录结构：

```text
sites/my-site/
sites/my-site/site.config.json
sites/my-site/deploy.settings.json
sites/my-site/content/docs/
sites/my-site/content/pages/
sites/my-site/content/posts/
```

如果从已有 site 复制文件，复制后必须直接改成新 site 的真实值。不要保留旧 site 的历史命名。

## 3. Configure Site Identity

`site.config.json` 是 build-time site identity 的唯一事实源。

最小示例：

```json
{
  "key": "my-site",
  "domain": "example.com",
  "brand": {
    "appName": "My Site",
    "appUrl": "https://example.com",
    "supportEmail": "support@example.com",
    "logo": "/logo.png",
    "favicon": "/favicon.ico",
    "previewImage": "/logo.png"
  },
  "capabilities": {
    "auth": true,
    "payment": "none",
    "ai": false,
    "docs": true,
    "blog": true
  },
  "configVersion": 1
}
```

字段规则：

- `key` 必须和 `sites/<site-key>` 目录名一致。
- `domain` 是裸域名，不带协议。
- `brand.appUrl` 是 canonical app origin，用于 metadata、sitemap、auth callback、payment callback 等。
- `brand.logo`、`brand.favicon`、`brand.previewImage` 指向 public asset path。
- `capabilities.payment` 只能是 `none`、`stripe`、`creem`、`paypal`。
- `configVersion` 当前必须是 `1`。

## 4. Configure Deploy Settings

`deploy.settings.json` 是 repo-controlled、site-scoped、infra-only deploy manifest。

最小形态：

```json
{
  "configVersion": 1,
  "bindingRequirements": {
    "secrets": {
      "authSharedSecret": true,
      "googleOauth": false,
      "githubOauth": false,
      "emailProvider": true,
      "openrouter": false
    },
    "vars": {
      "storagePublicBaseUrl": true
    }
  },
  "workers": {
    "router": "my-site-router",
    "state": "my-site-state",
    "public-web": "my-site-public-web",
    "auth": "my-site-auth",
    "payment": "my-site-payment",
    "member": "my-site-member",
    "chat": "my-site-chat",
    "admin": "my-site-admin"
  },
  "resources": {
    "incrementalCacheBucket": "my-site-opennext-cache",
    "appStorageBucket": "my-site-storage",
    "hyperdriveId": "00000000000000000000000000000000"
  },
  "state": {
    "schemaVersion": 1
  }
}
```

对齐规则：

- `site.config.json.capabilities.auth=true` 时，`bindingRequirements.secrets.emailProvider` 必须为 `true`。
- `site.config.json.capabilities.auth=false` 时，`bindingRequirements.secrets.emailProvider` 必须为 `false`。
- `site.config.json.capabilities.ai=true` 时，`bindingRequirements.secrets.openrouter` 必须为 `true`。
- `site.config.json.capabilities.ai=false` 时，`bindingRequirements.secrets.openrouter` 必须为 `false`。
- `workers.*` 必须是 Cloudflare-safe worker name。
- `resources.incrementalCacheBucket` 和 `resources.appStorageBucket` 必须是合法 R2 bucket name。
- `resources.hyperdriveId` 必须是真实 Cloudflare Hyperdrive id，格式是 32 位小写十六进制字符串。

不要把 auth、payment、AI、feature flags、runtime settings 或 secrets 作为顶层字段放进 `deploy.settings.json`。这些字段会被 schema 拒绝。

## 5. Add Site Content

所有 site 都必须有三个 content collection 目录：

```text
sites/my-site/content/docs/
sites/my-site/content/pages/
sites/my-site/content/posts/
```

能力开关和内容完整性必须一致：

- `capabilities.docs=true` 时，必须存在 `sites/my-site/content/docs/index.mdx`。
- `capabilities.blog=true` 时，`sites/my-site/content/posts/` 至少要有一个 `.mdx` 文件。
- `capabilities.docs=false` 或 `capabilities.blog=false` 时，目录仍然保留，但对应内容不会作为公开能力出现。

content source 会按当前 `SITE` 生成到 `.generated/content-source.ts`，运行时代码不应直接读取其他 site 的 content。

## 6. Run Local Verification

先跑最小站点选择链路：

```bash
SITE=my-site pnpm dev
```

再跑代码和架构验证：

```bash
SITE=my-site pnpm lint
SITE=my-site pnpm test
SITE=my-site pnpm lint:deps
SITE=my-site pnpm cf:check
```

如果要验证 Cloudflare 本地 split-worker runtime：

```bash
SITE=my-site pnpm test:cf-local-smoke
SITE=my-site pnpm test:cf-admin-settings-smoke
```

这些命令会通过 `scripts/run-with-site.mjs` 生成当前 site 的 `@/site` 和 content source。不要绕过这个入口直接调用底层 Next.js、OpenNext 或 Wrangler 命令。

## 7. Deploy The New Site

首次初始化或部分初始化的 Cloudflare 环境，先部署 state，再部署 app：

```bash
SITE=my-site pnpm cf:deploy:state
SITE=my-site pnpm cf:deploy
SITE=my-site pnpm test:cf-app-smoke
```

部署前需要确保：

- operator 机器上的 Wrangler OAuth 已登录，并且 `pnpm exec wrangler whoami` 通过。
- Cloudflare R2 bucket、Hyperdrive、custom domain、secrets、vars 已按 `deploy.settings.json` 准备。
- 如果 `src/config/db/schema.ts` 有变化，已生成并提交对应 `src/config/db/migrations/**` 文件，并在生产部署前完成数据库迁移。

生产部署权威入口是本地 operator session，不是 GitHub branch-tip 自动发布。

## 8. Update Documentation

新增正式 site 时，至少检查这些文档是否需要同步：

- `README.md`
- `docs/architecture/site-migration-inventory.md`
- `docs/architecture/cloudflare-deployment-governance.md`
- site 自己的 `sites/<site-key>/content/docs/**`

文档要描述当前真实 contract，不保留过时施工计划。

## Boundaries

必须保持以下边界：

- site identity 只来自 `sites/<site-key>/site.config.json` 和生成的 `@/site`。
- runtime binding 只来自 env、secrets、Cloudflare bindings 和 `deploy.settings.json` 解析结果。
- runtime settings 只表示上线后可在后台修改的业务配置。

禁止事项：

- 不要从 `NEXT_PUBLIC_APP_URL`、Wrangler 模板、数据库 settings 或 request host 反推 site identity。
- 不要把 `site.brand.*` 混回 admin/runtime settings。
- 不要新增旧站点 key 的 fallback。
- 不要新增只转发字段的 wrapper、adapter、shim 或 alias。
- 不要让多个 site 共用同一组生产 Cloudflare worker / bucket 名称。

## Compatibility Decision

- Compatibility required: no.
- Thin wrappers added: none.
- Aliases preserved: none.
- Legacy branches preserved: none.

新增 site 直接接入 `sites/<site-key>` 主干结构。调用方通过 `SITE=<site-key>` 和生成的 `@/site` 进入唯一运行路径。
