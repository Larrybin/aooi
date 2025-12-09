# 修复 localStorage SSR 报错

## 上下文
- 目标：修复 Next.js 16 开发环境下，由通用 cache 工具直接访问 localStorage 导致的 ReferenceError。
- 报错：ReferenceError: localStorage is not defined（src/shared/lib/cache.ts:5:26）。
- 约束：遵循 SOLID/KISS/DRY/YAGNI；保持现有行为不变；使用 Context7 获取 Next.js 客户端存储最佳实践。

## 方案概述
1. 在通用缓存工具中显式检测浏览器环境（window.localStorage）。
2. 在非浏览器环境（包括 SSR/构建阶段）时，缓存操作降级为 no-op / 返回 null，避免抛错。
3. 保留现有过期时间语义及 key/value 格式，不改调用方逻辑。

## 计划步骤
1. 分析现有 cache 工具与 LocaleDetector 调用方式，确认只依赖 localStorage。
2. 使用 Context7 查询 Next.js 对浏览器 API（window/localStorage）在 App Router 模式下的最佳实践。
3. 在 src/shared/lib/cache.ts 中添加 hasLocalStorage() 辅助函数，集中环境判断逻辑。
4. 在 cacheGet/cacheSet/cacheRemove/cacheClear 中统一调用 hasLocalStorage()，在非浏览器环境下安全返回 / no-op。
5. 保持过期时间逻辑与存储格式不变（"expiresAt:value"）。
6. 重新运行 dev，确认不再有 localStorage 相关报错，LocaleDetector 行为保持一致。
