# P0：收敛 dotenv side-effect 到 scripts/CLI（方案 A + B）

## 背景
- 风险：`src/config/load-dotenv.ts` 以 side-effect 方式进入 Next runtime 依赖图，可能造成环境变量污染、行为不可预测，且掩盖配置问题。
- 目标：Next runtime 仅依赖平台/Next 自身的 env 注入；仅在 scripts/CLI 上下文显式加载本地 `.env*` 文件。

## 范围
- 方案 A：从运行时链路移除 `import '@/config/load-dotenv'`
  - `src/core/db/index.ts`
  - `src/shared/models/config.ts`

- 方案 B：scripts/CLI 与 drizzle-kit 配置统一使用 Next 推荐的 `@next/env`
  - `src/config/load-dotenv.ts`：使用 `loadEnvConfig(process.cwd())`
  - `src/core/db/config.ts`（drizzle-kit config）：使用 `loadEnvConfig(process.cwd())`

- ESLint 防回归
  - 运行时代码禁止导入 `@/config/load-dotenv`
  - `scripts/**` 允许导入（保持 CLI 入口显式加载）

## 验证
- `pnpm lint`
- 可选：`pnpm build`
