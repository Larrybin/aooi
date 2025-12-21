---
task: "拆分 src/shared/components/ai-elements/prompt-input.tsx（方案A）"
constraints:
  - "对外导出名/类型/语义完全不变"
  - "导入路径保持不变：@/shared/components/ai-elements/prompt-input"
  - "尽量只做搬迁与门面 re-export，不做风格化重排"
approach:
  - "保留 prompt-input.tsx 为唯一入口（use client），其余实现下沉到 prompt-input/*"
  - "新增 internal.ts 仅供内部模块共享 context/可选 hooks，入口不 re-export 以避免新增公共 API"
steps:
  - "新增 prompt-input/{types,internal,controller,attachments,form,textarea,speech,primitives} 模块"
  - "用原文件代码原样搬迁，按依赖分层避免循环依赖"
  - "入口 prompt-input.tsx 替换为门面导出（保持 use client）"
  - "运行 npx tsc --noEmit 回归"

