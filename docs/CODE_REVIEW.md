## CODE REVIEW 指南（全栈 TypeScript + Next.js SaaS）

> 面向：有经验工程师，用于日常 PR 审查和首次全量代码质量盘点。  
> 审查顺序：**接口约束 → 安全 & 数据 → 逻辑正确性 → 性能 → 可读性/风格**。

---

## 0. 使用方式

- 快速清单（PR 模板）：`content/docs/code-review-checklist.zh.mdx`（docs 路由：`/zh/docs/code-review-checklist`）。
- PR 尺度：
  - 日常：建议小步提交，一个 PR 聚焦一个问题或功能。
  - 特殊：首次全量审查可以跨模块，但仍按本文件顺序逐项过一遍。
- 先机后人：
  - 要求通过 `pnpm lint`、`pnpm format:check`、`pnpm test`、`pnpm build`（含 TypeScript 检查）后再人工 review。
  - 机器负责“底线”，人重点看设计、边界条件和长期可维护性。
- 以护栏为准：
  - 依赖方向与 Server/Client 边界以 `eslint.config.mjs` 为单一事实来源（不要靠口头约定）。
  - `src/shared` 分层约定见 `docs/architecture/shared-layering.md`（变更触及边界时，优先用 ESLint 规则固化）。
- 新旧代码策略：
  - 本次是**第一次全量审查**，允许识别并记录历史技术债，但评论时明确“建议后续拆卡处理”。
  - 后续日常开发优先保证“新代码符合当前标准”，旧代码按需渐进式治理。

---

## 1. 接口约束（API / 组件 / Schema 边界）

### 1.1 Next.js App Router & RSC

- 数据获取位置：
  - 优先在 **Server Components / Route Handlers / Server Actions** 中直接访问数据库或外部 API。
  - 避免仅为调用内部后端而额外包一层“中转 API Route”，能在 RSC 里 fetch 的尽量在 RSC 内处理。
- Server/Client 边界：
  - `use client` 只出现在确需交互的叶子组件，避免无必要的 Client 组件膨胀。
  - Server Actions / Route Handlers 内不引用浏览器 API，不依赖 `window`、`document` 等前端上下文。
  - Client 组件不做安全关键逻辑判断（鉴权、权限、计费等），仅负责展示和用户交互。
- 组件角色清晰：
  - `src/app` 下的 `page.tsx` / `layout.tsx` / `template.tsx` 保持瘦：路由结构 + 数据注入，不堆叠业务细节。
  - 复杂 UI 抽到 `src/shared/blocks` / `src/shared/components`；业务编排下沉到 `src/shared/services`；核心能力下沉到 `src/core`；三方集成适配下沉到 `src/extensions`。

### 1.2 TypeScript 边界约束

- 严格模式：
  - `tsconfig.json` 应开启 `strict: true`，包括 `noImplicitAny`、`strictNullChecks` 等（官方推荐）。
  - 审查要点：公共 API（组件 props、Server Action 参数、Route Handler 入参/出参）不得使用裸 `any` / 混乱的 `unknown` 逃逸。
- 类型来源：
  - 前后端共享的 DTO / Domain 类型放在 `src/shared`，避免魔法字符串和重复结构。
  - 对复杂推断（联合数组等），优先按照官方建议**显式声明上层目标类型**，避免阅读困难。
- Schema 与 zod：
  - 对表单、接口 payload、query params 等，优先定义 zod schema，并通过 `z.infer` 推导 TypeScript 类型，做到“类型与校验同源”。
  - 审查时看到“手写 interface + 手写校验逻辑”的组合，应优先考虑合并为 zod 单一事实源。

### 1.3 Drizzle ORM Schema

- 单一事实源：
  - Drizzle TS schema 是数据库结构的单一真实来源。
  - 审查时确认：所有表定义都被导出，并被 drizzle-kit 迁移流程引用。
- 查询边界：
  - 常规读写需通过 Drizzle 类型安全 API，避免散落的 raw SQL。
  - 只有在确实需要复杂 SQL 时才使用 raw 查询，并附带注释说明原因与注意事项，同时保证参数绑定安全可控。

---

## 2. 安全 & 数据（Server Components / Auth / 支付 / 迁移）

### 2.1 Next.js 数据安全

- 机密数据位置：
  - **访问令牌、API keys、内部管理字段等必须只在服务端使用**，禁止通过 props 直接传给 Client 组件。
  - 使用 React Server Components 在服务端就近访问数据库和外部服务，避免在客户端暴露敏感信息。
- 数据暴露审查：
  - 检查所有从 Server 传到 Client 的数据结构，确认其中不含机密字段或不应泄露的内部状态。
- 输入验证：
  - 所有外部输入（`body` / `query` / `header`）必须有 schema 校验（zod 或同等级），禁止直接信任 `req.json()` / `request.formData()` 等原始数据。
  - 对高风险接口（认证、权限、计费、工作流执行等）优先采用更严格的 schema 和白名单策略。
- SSRF / 出站请求（Server-side fetch）：
  - 禁止将用户可控 URL 直接传入 `fetch()` / `safeFetch*()`；必须在服务端调用前做出站策略校验（协议、host/IP、重定向），并优先使用仓库封装：`checkOutboundUrl()`（`src/shared/lib/fetch/outbound-url.ts`） / `safeFetchFollowingRedirects()`（`src/shared/lib/fetch/server.ts`）。
  - 禁止在 `next.config.mjs` 的 `images.remotePatterns` 使用任意 hostname 通配（否则 `/_next/image` 可能被滥用为出站代理）；若无法维护稳定 allowlist，优先对动态远程图片使用 `unoptimized`（或全局禁用 Image Optimization）。

### 2.2 认证与权限

- Auth 边界：
  - Route Handler / Server Action 入口处必须做认证与权限检查，禁止在 Client 侧仅靠前端路由控制访问。
  - 授权信息以 session / claims / 角色等形式在服务端判定，避免“客户端告诉服务器自己是谁、拥有什么权限”。
- better-auth 集成：
  - 优先使用 better-auth 提供的统一 API 获取当前用户与租户信息，避免自建零散的鉴权工具函数。
  - better-auth 配置与类型应通过 `@better-auth/cli` 生成，而不是手写；若 PR 修改了认证逻辑，应检查生成脚本是否需要更新。
- CSRF（Cookie 会话 + 有副作用操作）：
  - 对“需要登录 + 写请求”的 Route Handler 统一使用 `requireUser(req)`（`src/shared/lib/api/guard.ts`），由 guard 执行 `Origin/Referer` 与 `Host/X-Forwarded-Host` 的同源校验。
  - 禁止绕过 guard 直接读取 session/用户信息后执行写操作（避免引入未受保护的入口）。
- 错误处理：
  - 明确区分业务错误（4xx）与系统错误（5xx），保证响应结构统一（如 `code` + `message` + 可选 `details`）。
  - Route Handler 返回应使用语义正确的 HTTP status（400/401/403/404/500 等），响应体仍保持 `{code,message,data}`（降低前端联动成本）。
  - Route Handler 优先使用 `withApi()`（`src/shared/lib/api/route.ts`）统一做错误归一化与响应封装，避免散落的 `try/catch + NextResponse.json()` 导致错误契约不一致。
  - Server Action 优先使用 `withAction()`（`src/shared/lib/action/with-action.ts`）统一错误归一化：仅对外暴露公共错误（`ActionError/BusinessError/ExternalError/ApiError`）的 `publicMessage`，并在返回体携带 `requestId` 便于排查。
  - 禁止在 Server Action 中通过 `throw new Error('<用户可见消息>')` 传递对外信息；用户可见提示必须用 `ActionError`（或 `BusinessError`）表达。
  - 禁止将数据库错误、支付网关返回原文等内部信息直接透传给前端，防止泄露实现细节或敏感信息。

### 2.3 数据库迁移（Drizzle Migrations）

- 迁移流程一致：
  - 生产环境必须通过 Drizzle 迁移（`generate` / `migrate` / `up` 等）管理 schema 变更。
  - 审查变更时关注：
    - 是否仅使用 `push` 改 schema 而无对应迁移脚本。
    - 是否有手写 SQL 改结构但未记录在迁移中。
- 本仓库约束（Postgres-only）：
  - drizzle-kit 配置为 `src/core/db/config.ts`，迁移输出目录为 `src/config/db/migrations`。
  - `DATABASE_PROVIDER` 在运行时/CLI 中被限制为 `postgresql`（错误配置需 fail-fast）。
- 迁移交付策略（必须明确）：
  - 迁移 SQL 属于交付物：当前 `.gitignore` 全局忽略 `*.sql`，但对 `src/config/db/migrations/**/*.sql` 显式放行；因此迁移文件应纳入版本控制，避免 schema 漂移。
- 连接与安全：
  - 迁移建议使用单连接执行（官方推荐），避免多连接导致不一致。
  - 避免在迁移中引入“环境专属/不可回滚”的变更（例如依赖人工顺序执行、或对历史数据做不可逆破坏性改写）。

### 2.4 支付 & 计费（creem）

> 本项目支付重点关注 **creem** 集成，以下为通用合规实践，需结合 creem 官方文档逐项对照。

- 回调与签名：
  - 所有 creem 回调/通知端点必须验证签名或 token，确保请求来源可信。
  - 回调处理逻辑使用原始请求体或 creem 要求的校验方式，避免仅凭字段存在性判断。
- 幂等性与重放防护：
  - 对“扣费、退款、订阅变更”等操作使用幂等键或业务唯一键（如订单号），防止重复执行。
  - 审查时确认：即便同一通知重复到达，也不会导致重复扣款或重复状态迁移。
- 金额与币种：
  - 后端以 creem 通知/结算记录为准，前端金额仅用于展示，不参与最终决策。
  - 金额与币种逻辑应集中在服务端编排层（例如 `src/core/payment/flows/**` + `src/core/payment/providers/**`），避免散落在各个 Route / 组件中。

### 2.5 邮件（resend）

- 模板与文案：
  - 邮件 provider 与发送能力集中在 `src/extensions/email/**` 与 `src/shared/services/email.ts`，避免在各个 handler 内部直接拼接 HTML 字符串/直接调用 SDK。
  - 模板文案应复用国际化资源或集中常量，避免在多处硬编码内容导致维护困难。
- 发送可靠性：
  - 关键邮件（注册激活、密码重置、账单通知等）发送失败必须至少记录结构化日志，必要时提供重试/补发机制。
  - 审查时关注：是否存在静默失败路径（异常被捕获但既不记录也不反馈），影响调试与用户体验。

---

## 3. 逻辑正确性（React 状态 / Hooks / 事务 / 工作流）

### 3.1 React 逻辑组织

- 避免滥用 Effect：
  - 对照 React 文档 “You Might Not Need an Effect”：纯计算/派生状态尽量用普通变量或 memo，而不是 `useEffect` 驱动。
  - 审查时看到复杂的 Effect，应检查：
    - 是否在 Effect 中做了可改为渲染阶段的逻辑。
    - 依赖数组是否正确，是否会导致隐藏的重复调用/竞态。
- 模块外数据预处理：
  - 对静态或配置型数据，遵循官方建议：放在模块顶层处理，避免在每次渲染时重复计算。
- React 19 + Compiler：
  - 避免在 render 中创建非稳定对象/函数，关注闭包捕获，降低 React Compiler 插桩和优化难度。
  - 仅在必要时使用 `useCallback` / `useMemo`，其依赖列表必须与实际使用保持一致，避免“假优化”或隐藏的性能问题。

### 3.2 Drizzle 查询与事务

- 类型与约束：
  - 查询字段应基于 schema 类型推导，避免直接写字符串列名。
  - 输入/输出类型与 zod 等校验 schema 对齐（表单和接口服从同一数据约束）。
- 事务边界：
  - 涉及余额、配额、工作流状态切换等关键场景必须使用数据库事务。
  - 审查时关注：
    - 是否正确处理事务成功/失败分支。
    - 是否考虑并发场景（重复请求、重放通知等）。

### 3.3 工作流 & AI 相关逻辑

- 成本与重试：
  - 对每次模型调用检查是否有多余调用、是否存在合并/缓存空间。
  - 审查时确认：失败重试策略是否合理，避免无限重试或静默失败。
- 数据一致性：
  - 文档/聊天/工作流状态的变更要么落到数据库，要么有持久化策略；避免仅留在内存或临时状态。

### 3.4 表单与校验（react-hook-form + zod）

- 单一数据源：
  - `react-hook-form` 配合 `zodResolver` 使用，保证 zod schema 是表单字段的唯一真相来源，不再额外手写一份校验逻辑。
  - 错误提示统一走封装好的表单 UI 组件，避免在各个表单内部硬编码错误文案和展示方式。
- User flow：
  - 提交时有明确的 loading / disabled 状态，防止重复点击或不确定是否提交成功。
  - 成功/失败反馈清晰，可通过 toast / inline 提示等统一组件实现，避免“点提交没反应”的体验。

---

## 4. 性能（数据获取模式 / JS 体积 / Tailwind & 动画）

### 4.1 Next.js 数据获取与缓存

- 服务端优先：
  - 遵循官方推荐：尽量在服务器端（RSC / Route Handlers）获取数据，减少客户端请求 waterfall。
  - 审查要点：
    - 是否在 Client Component 中用 `useEffect` 做多次 API 轮询，本可在服务端聚合。
    - 静态/半静态数据是否被错误标记为 `no-store`，导致无法利用缓存。
- 并行与流式：
  - 利用 Next.js 并行数据获取和 streaming 功能，避免串行等待链。

### 4.2 JS 体积与代码拆分

- 路由级拆分：
  - App Router 默认按路由边界拆包，审查时关注是否在单个 page 中引入体积巨大的依赖而不必要。
- 惰性加载：
  - 对低频功能、重型可视化组件、管理后台模块，优先考虑动态导入/按需加载。

### 4.3 Tailwind & 动画

- Tailwind 最佳实践：
  - 响应式样式通过断点前缀（如 `md:`, `lg:`）实现，不再编写重复媒体查询。
  - 当前仓库默认仅支持浅色主题；避免引入 `dark:` 或主题切换逻辑（除非另有明确需求与验收标准）。
- 动画与交互：
  - 使用 framer-motion / motion 等库时，避免对长列表/大 DOM 树添加复杂动画。
  - 审查时关注动画是否影响交互响应性和可访问性（例如焦点顺序、可中断性）。

---

## 5. 可读性 / 风格（TypeScript / Tailwind / 结构化）

### 5.1 TypeScript 风格与严格性

- 严格检查：
  - 新代码默认满足 strict 检查，通过 TS 编译无警告。
  - 禁止在公共边界使用隐式 `any`；必要时使用显式类型或泛型约束。
- 命名与结构：
  - 类型/接口使用 PascalCase，变量/函数使用 camelCase，遵循已有代码库约定。

### 5.2 Tailwind 与 UI 风格

- Utility 组合：
  - 类名应表达清晰的布局/样式意图，避免堆砌无语义的长串 class。
  - 多处复用的样式可抽成组件或封装的 className 工具，减少重复。
- 设计系统与组件库：
  - 优先复用已有设计系统组件（基于 radix-ui 封装的按钮、弹窗、菜单等），避免不同 PR 内部私造风格不一致的 UI。
  - 图标（lucide-react）、命令面板（cmdk）、通知（sonner）、图表（recharts）等第三方库应通过统一封装层使用，而不是在各处裸用。
- 可访问性：
  - 表单控件、弹窗、菜单等交互组件优先基于 radix primitives，审查时需关注 `aria-*` 属性、键盘操作与焦点管理是否满足基本无障碍要求。
- 主题、文案与内容：
  - 不在代码中硬编码文案，统一通过 next-intl 文本资源；新增文案需同步对应 locale 文件，并保证 key 语义清晰（避免 `common.message1` 这类命名）。
  - 主题：当前仅浅色；样式应优先使用主题 token（`src/config/style/theme.css`），避免硬编码颜色造成风格漂移。
  - MDX 文档与内容使用 fumadocs-\* 等专用组件处理，避免在页面中直接硬写 HTML；代码块统一走 shiki 高亮，保证重要示例代码可复制可运行。

### 5.3 结构一致性

- 文件粒度：
  - page/layout 负责路由结构与数据装配，核心业务逻辑下沉到 `src/core`，UI 基础件放在 `src/shared`。
  - 审查时对“超大文件”优先建议拆分为多个更易理解的模块。

---

## 6. 首次全量审查基线 Checklist

> 第一次大范围审查仓库时，可按以下顺序快速扫一遍：

- **TypeScript 严格性**
  - `tsconfig.json` 是否开启 `strict` 相关选项？
  - 关键模块中是否存在大量 `any` / `unknown`？
- **Next.js 结构与数据获取**
  - 数据密集型页面是否采用 Server Components / Route Handlers 获取数据？
  - 是否存在“前端间接调用后端”的多余 API 中转层？
- **安全 & 数据**
  - 是否有在 Client 侧暴露敏感字段或令牌的情况？
  - creem 支付回调是否都做了签名校验和幂等处理？
- **数据库与迁移**
  - Drizzle schema 是否完整覆盖数据库结构？
  - 所有结构变更是否都有对应迁移脚本并被执行？
- **性能与体验**
  - 是否有明显的大包依赖在首屏无必要引入？
  - 长列表、复杂页面是否有基本的性能和交互优化（分页、虚拟化、按需加载）？
- **风格与一致性**
  - 是否统一使用 Tailwind utility 和项目既有组件，不混用多种风格？
  - 国际化、主题、设计系统是否在所有新页面中得到一致使用？

---

## 7. 场景化审查示例：支付闭环（creem）

> 面向路径：pricing 页面 → checkout API → creem 支付 → callback → 订单 / 订阅 / 权益（credits）落账。

- **接口与输入校验**
  - `POST /api/payment/checkout` 等入口必须对请求体使用 zod schema 校验（`product_id`、`currency`、`locale`、`payment_provider`、`metadata` 等），禁止只用手写 `if` 判断。
  - 回调入口（如 `/api/payment/callback`）对 query params 至少做基本格式约束（长度、字符集），不要直接信任原始字符串。

- **金额与币种逻辑**
  - 下单金额与 currency 必须完全依据服务端配置（例如 pricing 文案 / server-side config）计算，前端仅可建议 currency，绝不能直接使用前端传入的 amount。
  - 多币种场景需明确 fallback 规则（找不到 currency 时退回默认币种），并在 code review 中检查这一条路径是否覆盖。

- **订单状态与幂等性**
  - 审查 `OrderStatus` 等枚举含义是否清晰（如 PENDING/CREATED/PAID/FAILED 等），并在团队文档中解释每个状态的业务语义，避免“名称与含义不一致”。
  - 使用事务函数（如 `updateOrderInTransaction` / `updateSubscriptionInTransaction`）处理「订单 + 订阅 + 权益」的组合更新，审查是否存在“先插多条再补救”的非幂等写法。
  - 通过 `(transactionId, paymentProvider)`、`subscriptionId` 等键构造逻辑幂等，避免重复扣费或重复发放权益。

- **支付回调与会话校验**
  - callback 路由必须：
    - 根据订单中的 `paymentSessionId` / `paymentProvider` 调用 provider 会话查询，而不是信任前端 query 中的状态字段。
    - 校验当前登录用户与订单 `userId` 一致，避免越权查询和篡改。
  - 如果 creem 提供 webhook / 签名机制，优先通过服务端 webhook 触发状态落账，前端回调仅用于用户体验层面的重定向。

- **错误处理与日志**
  - 对外返回的错误信息不应包含第三方网关的原始错误详情（例如内部错误码、敏感 message），而是使用统一结构：`code` + 用户可读的 `message` + 可选 `details`（仅写入日志）。
  - 关键路径（checkout 创建、支付确认、订阅状态变更、权益发放）必须有结构化日志（包含 orderNo、userId、provider、transactionId 等），便于后续对账和排查。

- **creem 特有配置**
  - 有基于 creem 的 `product_id` / `payment_product_id` 映射时，配置建议集中在单一位置（如 config 表或环境配置），并在 code review 中核对：
    - 是否存在以 `productId_currency` 为 key 的多币种映射；
    - 代码中解析和 fallback 逻辑是否与配置约定一致。
  - 审查任何 `provider !== 'creem'` 的分支，确认不会误用 creem 特有逻辑到其他支付通道上。
