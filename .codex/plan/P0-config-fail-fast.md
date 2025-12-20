# P0：配置读取 fail-fast（方案 2）

## 背景
- 目标：当 `DATABASE_URL` 已配置时，关键路径读取 DB 配置失败必须中止（抛错），避免静默降级。
- 例外：保留后台 Settings 页对 `getConfigsSafe()` 的降级体验（可浏览但不可保存），以减少运营影响。

## 范围
- 修改 `src/shared/models/config.ts`：
  - `getAllConfigs()`：移除 try/catch，DB 读取失败直接抛错（fail-fast）。
  - `getPublicConfigs()`：移除 try/catch，DB 读取失败直接抛错（fail-fast）。
  - `getConfigsSafe()`：保持现状（catch 后返回 `{ configs: {}, error }`），用于 Settings 页 UX。

## 预期行为变化
- `getAllConfigs()` 调用方（如 `src/core/auth/config.ts`、`src/shared/services/config_refresh_policy.ts`、`src/app/api/payment/checkout/route.ts` 等）在 DB 读取失败时会直接失败：
  - Route Handler：被 `src/shared/lib/api/route.ts` 的 `withApi()` 捕获，返回 500（不泄露细节）。
  - Server Components/Pages：触发对应 route segment error boundary（若存在 `error.tsx`）。
- `getPublicConfigs()`（`src/app/api/config/get-configs/route.ts`）在 DB 读取失败时返回 500。
- Settings 页仍可通过 `getConfigsSafe()` 展示“加载失败且不可保存”的提示（现有逻辑）。

## 执行步骤
1) 更新 `src/shared/models/config.ts`
   - 删除 `getAllConfigs()` 中的 try/catch（保留调用 `getConfigs()`）。
   - 删除 `getPublicConfigs()` 中的 try/catch，并移除 `typeof window === 'undefined'` 分支（该文件已 `server-only`）。

2) 回归验证
   - `npx tsc --noEmit`
   - `pnpm build`
   - 可选：`pnpm lint`（若你希望将 lint 作为 P0 门槛）

## 风险
- 构建/运行时在 DB 不可达时更早失败（符合 fail-fast，但会暴露部署环境问题）。
- 部分非关键页面若间接依赖 `getAllConfigs()`，也会 fail-fast（预期内）。
