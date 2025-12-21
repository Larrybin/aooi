# P2：非 `/api` fetch 规范化（方案 1）

## 背景与目标

当前 `src/` 内存在多类“非 `/api`”的 `fetch()`：

- **Client 侧资源下载/转换**：音频下载、图片下载、blob URL 转 data URL
- **Server 侧第三方 API 调用**：AI provider、PayPal、Creem
- **Server 侧外链下载后上传**：S3/R2 `downloadAndUpload`

本轮目标：

- 统一 **超时**：client 20s；第三方 API 15s；外链下载 30s
- 默认 **不重试**
- 统一 **错误可读性**：client 友好 toast；server 日志具备定位信息
- 统一 **URL 脱敏**：不输出 querystring；仅记录 origin + pathname
- Server 外部请求显式 `cache: 'no-store'`，避免 Next.js Data Cache 语义误用

范围：仅 `src/`。不引入新依赖。

## 方案选择

采用 **方案 1**：新增薄的 `safeFetch*` 工具，并按场景渐进替换。

## 设计要点（KISS / DRY）

### 1) URL 脱敏

- 新增 `sanitizeUrlForLog(url: string): string`
  - 只保留 `origin + pathname`
  - URL 解析失败时返回空字符串或原始字符串的安全截断

### 2) 超时与 Abort

- 新增 `fetchWithTimeout(input, init, timeoutMs)`：
  - 使用 `AbortController`
  - 若 `init.signal` 已存在：组合/继承（优先尊重外部 signal）
  - timeout 到期统一抛 `Error('request timeout')`（内部包装可附带 `timeoutMs`、`url`）

### 3) Server 侧 JSON 请求

- 新增 `safeFetchJson<T>(url, init, { timeoutMs, cache, parseErrorMessage })`
  - 强制 `cache: 'no-store'`（默认）
  - `!ok`：尝试读取 body（json/text）并拼接可读错误，但不泄漏敏感信息

### 4) Client 侧 blob 下载

- 新增 `fetchBlobWithTimeout(url, timeoutMs): Promise<Blob>`
  - 失败抛可理解错误（不包含完整 URL）
  - toast 层由调用方负责（或提供 `toastDownloadError` helper）

## 实施步骤（原子化）

### Step A：新增工具模块

新增：

- `src/shared/lib/fetch/sanitize-url.ts`
- `src/shared/lib/fetch/timeout.ts`
- `src/shared/lib/fetch/server.ts`（`server-only`）
- `src/shared/lib/fetch/client.ts`（`use client`）

预期结果：

- Server 侧第三方调用可以：`safeFetchJson` / `safeFetchText` / `safeFetchArrayBuffer`
- Client 侧下载可以：`fetchBlobWithTimeout`

### Step B：替换 client 点位

- `src/shared/blocks/generator/music.tsx`
  - `fetch(song.audioUrl)` → `fetchBlobWithTimeout(song.audioUrl, 20000)`
- `src/shared/blocks/generator/image.tsx`
  - `fetch(image.url)` → `fetchBlobWithTimeout(image.url, 20000)`
- `src/shared/components/ai-elements/prompt-input/form.tsx`
  - `fetch(url)`（blob URL） → `fetchBlobWithTimeout(url, 20000)`（此处不 toast，仅抛错）

### Step C：替换 server 第三方调用点位

- `src/extensions/ai/kie.ts`
  - `fetch(apiUrl)` → `safeFetchJson`（15000，`cache:'no-store'`）
- `src/extensions/payment/paypal.ts`
  - token 获取、通用 request：统一走 `safeFetchJson`
- `src/extensions/payment/creem.ts`
  - `fetch(url)` → `safeFetchJson`
- `src/extensions/storage/s3.ts` / `src/extensions/storage/r2.ts`
  - `fetch(options.url)` → `safeFetchArrayBuffer`（30000，`cache:'no-store'`）

### Step D：验证

- `pnpm lint`
- `NODE_OPTIONS=--dns-result-order=ipv4first pnpm build`
- 手动回归：
  - 下载音频/图片：断网或 404 时 toast 友好且不泄漏 URL query
  - AI provider / payment provider：失败日志含脱敏 URL、status、timeoutMs

## 风险与回滚

- 主要风险：第三方调用对 `cache`/headers 依赖、response body 解析异常
- 回滚方式：逐文件回退到原 `fetch`（改动点明确）

