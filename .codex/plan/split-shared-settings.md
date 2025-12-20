---
task: "拆分 src/shared/services/settings.ts（方案2）"
constraints:
  - "对外导出 API/导入路径完全不变（仍从 '@/shared/services/settings' 导入）"
  - "行为不变（尤其是设置项顺序与服务端边界语义）"
  - "不新增 env"
notes:
  - "settings.ts 当前混合：types + next-intl(server) i18n + 巨型 Setting[] 定义"
  - "为保持与现状一致，整个 settings service 继续保持 server-only 边界"
plan:
  - "新增 src/shared/services/settings/* 职责模块（types/tabs/groups/index）"
  - "将 getSettings() 的静态配置按 tab 拆到 definitions/*"
  - "src/shared/services/settings.ts 变为 server-only 门面：re-export './settings'"
  - "保持拼接顺序与原数组完全一致"
  - "运行 npx tsc --noEmit 回归"

