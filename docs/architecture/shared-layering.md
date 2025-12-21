# Shared 分层约定（P1）

本仓库的 `src/shared` 并不是单一语义的“纯共享库”，而是多个子域的集合。为降低耦合并提升可维护性，约定如下：

## 1) `src/shared/models/**`（DAL / Repo / Facade）

- 目标：集中数据访问与数据形态（DTO）转换，便于审计与复用。
- 允许依赖：`@/core/db`、`@/config/db/schema`、`drizzle-orm`、同层 `models`/`schemas`/`shared/lib`。
- 禁止依赖：
  - UI：`@/shared/blocks/**`、`@/shared/components/**`
  - docs/mdx：`@/core/docs/**`、`@/mdx-components`
- 备注：如需内容渲染/TOC/MDX 组装，一律下沉到 `src/shared/content/**`。

## 2) `src/shared/content/**`（Content Pipeline，server-only）

- 目标：承载 docs/mdx、本地内容源（如 posts/pages）等内容管道能力。
- 必须：`import 'server-only'`（防止误导入 client bundle）。
- 允许依赖：`@/core/docs/**`、`@/mdx-components`、`fumadocs-*`、以及 `shared/lib` 的纯函数工具。
- 约定：日期格式等跨来源一致性逻辑优先放在 `src/shared/lib/**`（例如 `src/shared/lib/post-date.ts`），避免重复实现。

## 3) `src/shared/services/**`（Server Services / Wiring）

- 目标：承载 server-only 的业务服务装配与策略（config-driven wiring、强一致装配等）。
- 必须：`import 'server-only'`。
- 允许依赖：`shared/models`、`extensions/*`、`config/*`。
- 禁止依赖：UI/入口层（如 `shared/blocks|components|contexts|hooks`、`themes`、`app`），避免服务层反向依赖导致耦合扩大。

## 4) `src/shared/blocks/**`、`src/shared/components/**`、`src/shared/contexts/**`（UI 共享层）

- 目标：复用 UI 构件，不承诺跨项目复用。
- 允许的 core 依赖面（P0 固化）：仅
  - `@/core/i18n/navigation`
  - `@/core/auth/client`
- 其它 `@/core/**` 一律禁止（避免 UI 层耦合 core 的任意子域）。
- Client/Server 隔离（P1 固化）：
  - UI/Client 面禁止导入：`next/headers`、`@/core/db/**`、`@/shared/services/**`、`@/shared/content/**`、以及任何 `*.server` 模块。
  - 新增散点 Client 模块请使用 `*.client.ts(x)` 或放入 `**/client/**` 目录，以便被 ESLint 规则自动纳管。

## 5) ESLint 约束（单一事实来源）

上述边界以 `eslint.config.mjs` 为准。新增文件或重构时，优先通过 lint 规则体现边界，而不是靠口头约定。

## 6) `src/app/**/route.ts`（Route Handler 入口约束）

- 目标：保持 handler 仅做编排（鉴权/校验/调用 services/返回响应），避免引入 UI 依赖图。
- 禁止依赖：`shared/blocks|components|contexts`、`themes` 以及任何 client-only 模块（如 `*.client.*`、`**/client/**`、`client-only`）。
