# P1-4：ChatLibrary 关键请求失败不再静默吞错

## 背景
- 文档来源：`docs/ROBUSTNESS_AUDIT.md`（P1-4）
- 问题：`src/shared/blocks/chat/library.tsx` 在拉取 chat list 失败时仅 `console.log`，用户侧无明确反馈，且缺少 requestId 展示。

## 目标
- 用户侧显式反馈（toast），尽量携带 requestId。
- 控制回归面：不引入重型 UI 重构。
- 验收：`pnpm lint` + `pnpm build` 通过。

## 实施方案
- 在 `ChatLibrary` 的 `fetchChats` catch：
  - 使用 `toastFetchError(e, 'Failed to load chats')` 替代 `console.log`。
  - 为避免频繁 toast，引入 `useRef` 记录是否已经 toast 过（每次挂载周期仅提示一次）。

## 文件清单
- 修改：`src/shared/blocks/chat/library.tsx`
- 修改：`docs/ROBUSTNESS_AUDIT.md`（更新 P1-4 状态）

## 验收步骤
- `pnpm lint`
- `pnpm build`
