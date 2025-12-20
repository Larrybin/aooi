# 上下文

目标：先修复 3 个阻断项，再进行“收敛变更集”。

阻断项：
1) 页面级 `use client`：`src/app/[locale]/(chat)/chat/[id]/page.tsx` 与 `src/app/[locale]/(chat)/layout.tsx` 导致整段 client 化，且在 `useEffect` 内编排核心数据加载。
2) env 公私混用 + client 引用：`src/config/index.ts` 同时包含 `DATABASE_URL/AUTH_SECRET`，且被 `use client` 模块直接 import。
3) client 侧疑似使用 server secret：`src/core/auth/client.ts` 将 `envConfigs.auth_secret` 传给 `createAuthClient`（与“私密 key 不进客户端”冲突）。

约束/决定：
- Chat 未登录：统一 `redirect("/{locale}/sign-in")`。
- Better Auth client 侧 baseURL：按最佳实践显式配置（Context7：同域可省略，但本项目要求显式设置）；且 client 侧不传 `secret`。
- Chat 路由结构对齐 `src/app/[locale]/(admin)/layout.tsx`：layout/page 变回 Server，数据从 DB/model 直取（避免 /api round-trip），交互保留在 `ChatBox/ChatContextProvider` 等 Client 组件。
- env 拆分：`src/config/index.ts` 仅导出 public（`NEXT_PUBLIC_*`）；新增 `src/config/server.ts`（`server-only`）集中导出 server-only secret 与 DB 配置。

# 计划摘要（已批准，进入执行）

1) env 拆分：新增 `src/config/server.ts`；收敛 `src/config/index.ts` 为 public-only；更新 DB/Auth server 侧引用点改用 `serverEnv`。
2) Better Auth client：`src/core/auth/client.ts` 移除 `secret`，显式设置 `baseURL` 为 `envConfigs.app_url`。
3) Chat 路由 Server 化：
   - `src/app/[locale]/(chat)/layout.tsx` 去 `use client`，改为 `getTranslations/setRequestLocale`。
   - `src/app/[locale]/(chat)/chat/[id]/page.tsx` 去 `use client/useEffect`，server 侧鉴权+读 DB，未登录 redirect 到 `/{locale}/sign-in`，将初始数据作为 props 传入 `ChatBox`。
4) 回归验证：`pnpm lint`、`pnpm build:fast`。
5) 完成后进入“收敛变更集”预演清单输出，待用户再次确认再执行批量回滚/清理。

