---
task: P2：DB/config 增加 server-only 边界 + 下沉 publicSettingNames 常量（解除 models -> services 反向依赖）
mode: 执行计划存档
scope:
  include:
    - src/shared/models/config.ts
    - src/shared/services/settings.ts
    - src/shared/services/config_refresh_policy.ts
    - src/core/db/index.ts
    - src/core/db/config.ts
    - src/shared/constants/public-setting-names.ts
    - package.json
    - pnpm-lock.yaml
principles: [SOLID, KISS, DRY, YAGNI]
constraints:
  - 对外导出 API 不变
  - 仅收紧错误导入（server-only），不改变运行逻辑
motivation:
  - 防止 DB/config 模块被误导入 client bundle
  - 解除 src/shared/models/config.ts -> src/shared/services/settings.ts 的反向依赖
deliverable:
  - 新增常量模块并在 settings/config 中复用
  - DB/config 相关模块添加 `import 'server-only'`
  - 添加依赖 `server-only`
validation:
  - npx tsc --noEmit
---

## 执行步骤

1) 新增 `src/shared/constants/public-setting-names.ts`，集中定义 `publicSettingNames`
2) `src/shared/models/config.ts`：改从 constants 导入，移除对 services/settings 的依赖
3) `src/shared/services/settings.ts`：改为 re-export 常量，保持对外 API 不变
4) 为 DB/config 相关模块添加 `import 'server-only'`：
   - `src/core/db/index.ts`
   - `src/core/db/config.ts`
   - `src/shared/models/config.ts`
   - `src/shared/services/config_refresh_policy.ts`
5) `package.json` 添加依赖 `server-only` 并更新 lockfile
6) `npx tsc --noEmit`

