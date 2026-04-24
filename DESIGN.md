# Design System — Roller Rabbit

## Product Context

- **What this is:** 一个可直接起步的 AI SaaS mainline shell，覆盖 landing、pricing、docs/blog、auth、admin settings 等典型产品表面，同时允许按模块启用增长能力。
- **Who it's for:** 想快速上线、又不想让产品看起来像模板拼装的独立开发者、小团队和早期产品负责人。
- **Space/industry:** AI SaaS、开发者工具、内容驱动型产品官网。
- **Project type:** 混合型 Web 产品，包含 marketing site、editorial content、pricing conversion 页面和后台配置面。

## Aesthetic Direction

- **Direction:** Calm Technical Editorial
- **Decoration level:** intentional
- **Mood:** 先让人感觉这个产品靠谱、清楚、能上线收款，再在局部给一点记忆点。不是极简到没有表情，也不是到处发光发亮的 AI demo 风。
- **Reference sites:** 本版未做外部视觉竞品截图调研，直接基于现有主题实现、页面结构和 ads provider/zone 计划收敛。

## Typography

- **Display/Hero:** `Space Grotesk`，给 hero、pricing 数字和关键 section 标题一点技术感和辨识度，但只在高层级使用，避免整站变得过躁。
- **Body:** `Instrument Sans`，正文、说明文字、博客阅读、表单帮助文案都用它，读感平稳，适合长时间阅读。
- **UI/Labels:** `Instrument Sans`，按钮、导航、badge、表单标签保持同一套 UI 语言。
- **Data/Tables:** `IBM Plex Mono`，只用于价格、配额、code、表格数字和少量技术标签，必须开启 `tabular-nums`。
- **Code:** `IBM Plex Mono`
- **Loading:** 优先使用 Google Fonts 或 Bunny Fonts 加载 `Space Grotesk`、`Instrument Sans`、`IBM Plex Mono`；如果实现阶段要本地化字体，也必须保持这三种角色分工，不要临时退回 `Inter` / `Arial`。
- **Scale:** `12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60 / 72`
  - `12`: legal、caption、辅助说明
  - `14`: nav、button、meta、table label
  - `16`: 正文基准
  - `18`: 长描述、pricing 描述、重要 body
  - `24-36`: section 标题
  - `48-72`: hero / pricing 主数字

## Color

- **Approach:** restrained
- **Primary:** `#4F6EF7`，用于核心 CTA、激活状态、重要数字、少量焦点线条。蓝色保留“可信、产品化、冷静”的主基调。
- **Secondary:** `#E6EEFF`，用于轻强调背景、标签底色、选中态辅助层，不跟 primary 争抢视觉中心。
- **Neutrals:** 冷灰体系，从 `#FBFCFE` 到 `#0F172A`
  - `#FBFCFE`: 页面底
  - `#F4F7FB`: muted section / 柔和容器
  - `#E6EBF2`: border / divider
  - `#94A3B8`: 次级文字
  - `#334155`: 正文深色
  - `#0F172A`: 强标题 / dark surface 基础
- **Semantic:** success `#0F8A5F`，warning `#B7791F`，error `#C53B3E`，info `#2F6FED`
- **Dark mode:** 不做机械反相。深色模式使用 `#0F172A` / `#111827` 作为背景层级，primary 降低 10%-15% 饱和度，保留清晰边界和可读对比，禁止霓虹蓝大面积发光。

## Spacing

- **Base unit:** 8px
- **Density:** comfortable
- **Scale:** `2xs(4) xs(8) sm(12) md(16) lg(24) xl(32) 2xl(48) 3xl(64) 4xl(96)`
- **Section rhythm:** marketing 页面纵向节奏优先用 `64 / 96`，blog/detail 页面优先用 `24 / 32 / 48`，admin/settings 页面优先用 `16 / 24 / 32`。
- **Content measure:** 正文理想阅读宽度控制在 `68ch-76ch`，不要把 prose 拉成整屏。

## Layout

- **Approach:** hybrid
- **Grid:**
  - marketing: mobile `4` 列，tablet `8` 列，desktop `12` 列
  - blog-detail: `3 / 6 / 3` 或 `3 / 9`，正文永远是视觉主轴
  - pricing: 三卡或双卡并列，但标题区与切换控件必须集中，不得被其他信息打断
- **Max content width:** `1280px`，阅读与设置类内容内部子区域再收窄
- **Border radius:** `sm 8px`, `md 12px`, `lg 16px`, `xl 24px`, `pill 9999px`
- **Surface rules:** 卡片、pricing、testimonials、广告容器都要靠边框、轻阴影、背景层级建立秩序，不靠五颜六色大色块堆层次。

## Motion

- **Approach:** intentional
- **Easing:** `enter: cubic-bezier(0.16, 1, 0.3, 1)`，`exit: cubic-bezier(0.7, 0, 0.84, 0)`，`move: cubic-bezier(0.4, 0, 0.2, 1)`
- **Duration:** `micro 80ms`, `short 180ms`, `medium 280ms`, `long 480ms`
- **Rules:** 动效只用于层级切换、hover、accordion、scroll reveal。不要给核心 CTA 上花哨渐变动画，不要让广告容器自己做夺注意力的宿主动效。

## Page Rules

### Landing

- 信息顺序必须是：可信度建立，产品解释，能力展开，社会证明，最终 CTA。
- `Hero` 负责承诺和第一步行动，不承担广告或商业噪音。
- `Logos` 是首个信任锚点，之后才允许进入商业化转场。

### Blog / Docs Detail

- 阅读优先于转化。标题区、日期区、正文首屏、TOC 和作者信息都不放广告。
- 广告只能出现在已经建立阅读惯性之后，或者阅读结束之后。
- 正文宽度、行高、段落间距不能因为广告位而被压缩。

### Pricing

- `pricing` 页不插广告。
- pricing 是强决策面，所有注意力都服务于计划理解、价格比较、结账动作。

## Ad Surfaces

### Core Rule

- 广告是页面节奏元素，不是页面主叙事。
- 所有页面内广告位都必须走统一 zone 模型，`Display Banner` 和 `Native Banner` 也一样，不允许逃回 provider 私有模板。
- 页面只知道语义位置，不知道 provider 名称。

### Zone Placement

- **`landing_inline_primary`**
  - 位置：`Logos` 之后，`Introduce / Benefits` 之前
  - 角色：首屏信任建立后的转场位
  - 视觉：独立容器，和内容区共享同一水平节奏，宽度不超过主容器，不贴 Hero，不贴 CTA
- **`blog_post_inline`**
  - 位置：正文中后段，在首个主要内容块之后，建议落在全文 `45%-70%` 区间
  - 角色：轻转场位，承接已进入阅读状态的注意力
  - 视觉：必须是块级容器，不可插入单个段落流内，不可挤占 TOC/作者侧栏
- **`blog_post_footer`**
  - 位置：正文结束之后，作者卡或相关文章区块之前或之后
  - 角色：补充位，不参与正文叙事
  - 视觉：比 inline 更安静，可以更像“相关阅读/赞助位”而不是硬切广告墙

### Zone States

| Zone                     | Empty / Unsupported | Partial / Short Content        | Loaded                                               |
| ------------------------ | ------------------- | ------------------------------ | ---------------------------------------------------- |
| `landing_inline_primary` | 直接不渲染，不留白  | 不适用                         | 作为独立 section 渲染，和上下内容保留 `24-32px` 缓冲 |
| `blog_post_inline`       | 直接不渲染，不留白  | 短文直接跳过，不允许出现空盒子 | 渲染为正文中的独立转场块，前后保持 `32-48px` 节奏    |
| `blog_post_footer`       | 直接不渲染，不留白  | 不适用                         | 渲染为正文结束后的补充区块，避免与作者信息粘连       |

### Ad Container Rules

- 广告容器必须有明确边界，优先使用 `muted` 背景、`1px` 边框、轻阴影，而不是强色背景。
- 若需要宿主标签，仅允许小号 `Sponsored` / `Ad` 标签，位置固定在容器顶部，不可大面积抢戏。
- 广告内容允许比正文更“商业”，但宿主容器不能因此变成完全不同的视觉体系。

## Anti-Slop Rules

- 不要默认紫色或粉紫渐变。
- 不要把所有卡片都做成统一大圆角气泡。
- 不要使用“彩色圆形图标 + 三列 feature 卡”作为默认中段版式。
- 不要让广告位看起来像 broken widget，也不要故意伪装成正文内容。
- 不要在 pricing、hero、主要 CTA 附近塞任何商业噪音。

## Decisions Log

| Date       | Decision                                                        | Rationale                                                  |
| ---------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| 2026-04-10 | 初始设计系统建立                                                | 基于现有主题实现、ads provider/zone 实施计划和页面结构收敛 |
| 2026-04-10 | 采用 `Space Grotesk + Instrument Sans + IBM Plex Mono` 角色分工 | 让产品保留技术感和阅读稳定性，不退回模板化默认字体         |
| 2026-04-10 | 广告位被定义为版面节奏元素                                      | 保证 monetization 不破坏 landing 与 blog 的信息层级        |
| 2026-04-10 | `pricing` 页面明确不插广告                                      | 保持转化路径纯净，避免决策干扰                             |
