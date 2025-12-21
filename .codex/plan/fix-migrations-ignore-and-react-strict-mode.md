# 修复：迁移文件忽略导致 schema 漂移 + 启用 reactStrictMode

更新时间：2025-12-20

## 背景

- P1-3：`.gitignore` 忽略 `src/config/db/migrations/**` 且全局忽略 `*.sql`，可能导致新增迁移未被版本控制，进而造成环境间 schema 漂移。
- P2：`next.config.mjs` 显式关闭 `reactStrictMode`，不符合 Next.js 推荐实践，且在 App Router 中容易造成“配置与默认行为”误导。

## 方案（已确认）

1) 迁移文件入库（推荐的最小风险做法）
- 保留全局 `*.sql` 忽略（避免误提交 dump/临时 SQL）。
- 移除对 `src/config/db/migrations/**` 的忽略。
- 在 `*.sql` 规则后增加反向放行：`!src/config/db/migrations/**/*.sql`。

2) 启用 Strict Mode
- 将 `next.config.mjs` 的 `reactStrictMode` 改为 `true`（显式、直观）。

3) 同步文档
- 更新 `docs/ARCHITECTURE_REVIEW.md`：将 P1-3、P2 标记为已修复并补充证据。

## 验证

- `git check-ignore -v "src/config/db/migrations/0000_flashy_galactus.sql"` 不应命中忽略规则。
- 运行：`pnpm lint`、`pnpm build`。

