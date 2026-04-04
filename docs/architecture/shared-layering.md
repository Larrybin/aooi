# Shared / Features 分层约定（P1）

本轮重构后，仓库分层基线是：

- `src/app/**`：route-only，只做入口编排。
- `src/features/**`：按产品面拆分（`admin` / `web` / `docs`）。
- `src/shared/**`：只保留真正跨面的能力。

以下规则用于回答一个核心问题：**模块到底该落在 feature，还是 shared。**

## 0) 顶层放置原则

- 属于某一个产品面、且不需要跨面复用：放 `src/features/<surface>/**`
- 被多个面共同依赖、且语义稳定：放 `src/shared/**`
- 只属于 Next 路由入口：放 `src/app/**`

当前约定：

- `src/features/admin/**`：后台面，固定为 `server/` + `schemas/`
- `src/features/web/**`：用户端面，按子域再拆 `components/` + `server/`
- `src/features/docs/**`：docs/blog 面，本地内容流水线放在 `server/content/**`

## 1) `src/shared/models/**`（DAL / Repo / Facade）

- 目标：集中数据访问与数据形态（DTO）转换，便于审计与复用。
- 允许依赖：`@/core/db`、`@/config/db/schema`、`drizzle-orm`、同层 `models`/`schemas`/`shared/lib`。
- 禁止依赖：
  - UI：`@/shared/blocks/**`、`@/shared/components/**`
  - docs/mdx：`@/core/docs/**`、`@/mdx-components`
- 备注：如需 docs/blog 的内容渲染、TOC、MDX 组装，一律放到 `src/features/docs/server/content/**`，不要再挂回 `shared/models/**`。

## 2) `src/features/docs/server/content/**`（Docs / Blog Content Pipeline，server-only）

- 目标：承载 docs/mdx、本地 blog/page 内容源、TOC 组装、品牌占位符替换等 docs 面特有的内容管道。
- 必须：`import 'server-only'`（防止误导入 client bundle）。
- 允许依赖：`@/core/docs/**`、`@/mdx-components`、`fumadocs-*`、以及 `shared/lib` / `shared/models` 的纯 server 能力。
- 约定：跨来源一致性逻辑（例如日期格式、markdown TOC 构建）优先下沉到 `src/shared/lib/**`，避免重复实现。

## 3) `src/shared/content/**`（Cross-surface Content Assets，server-only）

- 目标：只承载真正跨面的 server-only 内容资产，例如事务邮件模板。
- 必须：`import 'server-only'`。
- 禁止继续承载 docs/blog/page 的本地内容流水线，避免 `shared` 再次变成“大杂烩”。

## 4) `src/shared/services/**`（Server Services / Wiring）

- 目标：承载 server-only 的业务服务装配与策略（config-driven wiring、强一致装配等）。
- 必须：`import 'server-only'`。
- 允许依赖：`shared/models`、`extensions/*`、`config/*`。
- 禁止依赖：UI/入口层（如 `shared/blocks|components|contexts|hooks`、`themes`、`app`），避免服务层反向依赖导致耦合扩大。

## 5) `src/shared/constants/**`（Leaf 常量层）

- 目标：承载跨模块共享的常量/枚举/权限码等，避免“仅取常量却引入 server-only 依赖”。
- 允许依赖：纯类型/纯常量模块（例如 `src/shared/types/**`、`src/shared/lib/**` 的纯函数工具）。
- 禁止依赖（P0 固化，见 `eslint.config.mjs`）：
  - `@/shared/services/**`
  - `@/shared/models/**`
  - `@/core/**`
- 示例：`src/shared/constants/rbac-permissions.ts`

## 6) `src/shared/blocks/**`、`src/shared/components/**`、`src/shared/contexts/**`（UI 共享层）

- 目标：复用真正跨面的 UI 构件，不承诺跨项目复用。
- 允许的 core 依赖面（P0 固化）：仅
  - `@/core/i18n/navigation`
  - `@/core/auth/client`
- 其它 `@/core/**` 一律禁止（避免 UI 层耦合 core 的任意子域）。
- 默认禁止依赖 `@/features/**`；登录弹窗等产品面组件应直接落在对应 feature，并由 `src/app/**` 或 `themes/**` 编排。
- Client/Server 隔离（P1 固化）：
  - UI/Client 面禁止导入：`next/headers`、`@/core/db/**`、`@/shared/services/**`、`@/shared/content/**`、以及任何 `*.server` 模块。
  - 新增散点 Client 模块请使用 `*.client.ts(x)` 或放入 `**/client/**` 目录，以便被 ESLint 规则自动纳管。

## 7) `src/features/**` 边界

- `features/admin/**`、`features/web/**`、`features/docs/**` 禁止互相直依赖。
- `src/app/**` 可以依赖任意 feature，负责最终编排。
- `features/**/server/**` 必须保持 server-only，禁止依赖 UI/client 层与 feature `components/**`。

## 8) ESLint 约束（单一事实来源）

上述边界以 `eslint.config.mjs` 为准。新增文件或重构时，优先通过 lint 规则体现边界，而不是靠口头约定。

## 9) `src/app/**/route.ts`（Route Handler 入口约束）

- 目标：保持 handler 仅做编排（鉴权/校验/调用 services/返回响应），避免引入 UI 依赖图。
- 禁止依赖：`shared/blocks|components|contexts`、`themes` 以及任何 client-only 模块（如 `*.client.*`、`**/client/**`、`client-only`）。
