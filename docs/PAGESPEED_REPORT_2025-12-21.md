# PageSpeed Insights 报告（roller-rabbit）

- 测试站点：`https://your-domain.com/`
- 测试工具：`https://pagespeed.web.dev/`（使用 Chrome MCP 自动化触发报告与采集结果）
- 测试语言：`zh-CN`
- 测试时间窗：`2025-12-21`（报告内 “Captured at … GMT+8 …” 为 Lighthouse 采集时间）
- 评分阈值：**任一分类评分 ≤ 95** 视为“需要记录问题点”（Performance / Accessibility / Best Practices / SEO）
- 说明：PageSpeed Insights / Lighthouse 结果存在波动；本报告记录本次采集的快照与问题点。
- 备注：`/showcases` 页面已从营销站点移除；本报告中与其相关的条目仅作为历史快照保留。

## 关键页面（本次测试清单）

- `https://your-domain.com/en`
- `https://your-domain.com/en/pricing`
- `https://your-domain.com/en/ai-chatbot`
- `https://your-domain.com/en/showcases`
- `https://your-domain.com/en/docs`
- `https://your-domain.com/en/docs/code-review-checklist`
- `https://your-domain.com/en/blog`
- `https://your-domain.com/en/blog/what-is-xxx`
- `https://your-domain.com/en/sign-in`
- `https://your-domain.com/en/sign-up`
- `https://your-domain.com/en/privacy-policy`
- `https://your-domain.com/en/terms-of-service`

## 总览（评分）

> 表格中 `P/A/BP/SEO` 分别代表：Performance / Accessibility / Best Practices / SEO。

| URL                              | Mobile (P/A/BP/SEO) | Desktop (P/A/BP/SEO) | 需要记录的问题（≤95）              |
| -------------------------------- | ------------------: | -------------------: | ---------------------------------- |
| `/en`                            | 59 / 100 / 96 / 100 |   71 / 91 / 96 / 100 | Mobile: P；Desktop: P、A           |
| `/en/pricing`                    |  75 / 90 / 96 / 100 |   79 / 86 / 96 / 100 | Mobile: P、A；Desktop: P、A        |
| `/en/ai-chatbot`                 |  58 / 98 / 96 / 100 |   77 / 89 / 96 / 100 | Mobile: P；Desktop: P、A           |
| `/en/showcases`                  |  61 / 98 / 96 / 100 |   74 / 89 / 96 / 100 | Mobile: P；Desktop: P、A           |
| `/en/docs`                       |   91 / 91 / 96 / 92 |   100 / 96 / 96 / 92 | Mobile: P、A、SEO；Desktop: SEO    |
| `/en/docs/code-review-checklist` |  90 / 91 / 96 / 100 |  100 / 96 / 96 / 100 | Mobile: P、A                       |
| `/en/blog`                       |  67 / 93 / 96 / 100 |   88 / 86 / 96 / 100 | Mobile: P、A；Desktop: P、A        |
| `/en/blog/what-is-xxx`           |  71 / 95 / 96 / 100 |   88 / 90 / 96 / 100 | Mobile: P、A；Desktop: P、A        |
| `/en/sign-in`                    |  94 / 95 / 96 / 100 |  100 / 95 / 96 / 100 | Mobile: P、A；Desktop: A           |
| `/en/sign-up`                    |  87 / 95 / 96 / 100 |   95 / 95 / 96 / 100 | Mobile: P、A；Desktop: P、A        |
| `/en/privacy-policy`             |   73 / 98 / 96 / 69 |    87 / 89 / 96 / 69 | Mobile: P、SEO；Desktop: P、A、SEO |
| `/en/terms-of-service`           |   72 / 98 / 96 / 69 |    90 / 89 / 96 / 69 | Mobile: P、SEO；Desktop: P、A、SEO |

## 详细问题点（按页面）

### 1) `/en`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en/7ked6lm7nw?form_factor=mobile`

**Mobile**

- 分数：P59 / A100 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:10，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 9.2s / TBT 560ms / CLS 0 / SI 4.2s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 强制自动重排
    - LCP 细分
    - 网络依赖关系树
    - 旧版 JavaScript 预计节省 14 KiB
    - 优化 DOM 大小
    - 缩短 JavaScript 执行用时 1.6 秒
    - 最大限度地减少主线程工作 3.5 秒
    - 减少未使用的 JavaScript 预计节省 616 KiB
    - 应避免出现长时间运行的主线程任务 发现了 6 项长时间运行的任务
    - 避免使用未合成的动画 发现了 37 个动画元素

**Desktop**

- 分数：P71 / A91 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:10，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 2.0s / TBT 390ms / CLS 0.001 / SI 1.8s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 80 毫秒
    - 强制自动重排
    - LCP 细分
    - 发现 LCP 请求
    - 网络依赖关系树
    - 改进图片传送 预计节省 19 KiB
    - 旧版 JavaScript 预计节省 14 KiB
    - 布局偏移原因
    - 优化 DOM 大小
    - 最大限度地减少主线程工作 2.5 秒
    - 减少未使用的 JavaScript 预计节省 618 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
    - 避免使用未合成的动画 发现了 37 个动画元素
- Accessibility
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。

### 2) `/en/pricing`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-pricing/r04kuclfht?form_factor=mobile`

**Mobile**

- 分数：P75 / A90 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:14，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 3.8s / TBT 490ms / CLS 0 / SI 3.2s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 强制自动重排
    - 网络依赖关系树
    - 旧版 JavaScript 预计节省 14 KiB
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 643 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
    - 避免使用未合成的动画 发现了 4 个动画元素
- Accessibility
  - [aria-*] 属性缺少有效值
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。
  - 图片元素没有属于多余文本的 [alt] 属性。

**Desktop**

- 分数：P79 / A86 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:14，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 1.0s / TBT 440ms / CLS 0.001 / SI 1.2s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 80 毫秒
    - 强制自动重排
    - 网络依赖关系树
    - 旧版 JavaScript 预计节省 14 KiB
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 646 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
    - 避免使用未合成的动画 发现了 4 个动画元素
- Accessibility
  - [aria-*] 属性缺少有效值
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。

### 3) `/en/ai-chatbot`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-ai-chatbot/dj31z9g0vi?form_factor=mobile`

**Mobile**

- 分数：P58 / A98 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:14，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 8.6s / TBT 610ms / CLS 0 / SI 3.6s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - LCP 细分
    - 网络依赖关系树
    - 缩短 JavaScript 执行用时 1.3 秒
    - 最大限度地减少主线程工作 2.4 秒
    - 减少未使用的 JavaScript 预计节省 645 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
    - 避免使用未合成的动画 发现了 2 个动画元素

**Desktop**

- 分数：P77 / A89 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:14，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 1.7s / TBT 360ms / CLS 0.001 / SI 1.1s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 80 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 网络依赖关系树
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 648 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
    - 避免使用未合成的动画 发现了 2 个动画元素
- Accessibility
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。

### 4) `/en/showcases`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-showcases/pciltl1t2l?form_factor=mobile`

**Mobile**

- 分数：P61 / A98 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:15，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 8.8s / TBT 540ms / CLS 0 / SI 3.4s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 发现 LCP 请求
    - 网络依赖关系树
    - 旧版 JavaScript 预计节省 14 KiB
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 648 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
    - 避免使用未合成的动画 发现了 5 个动画元素

**Desktop**

- 分数：P74 / A89 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:15，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 1.7s / TBT 430ms / CLS 0.001 / SI 1.4s
  - 问题点：
    - 改进图片传送 预计节省 30 KiB
    - 旧版 JavaScript 预计节省 14 KiB
    - 渲染屏蔽请求 预计缩短 80 毫秒
    - 发现 LCP 请求
    - 网络依赖关系树
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 651 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
    - 避免使用未合成的动画 发现了 5 个动画元素
- Accessibility
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。

### 5) `/en/docs`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-docs/m21wl60p3b?form_factor=mobile`

**Mobile**

- 分数：P91 / A91 / BP96 / SEO92
- Performance（Captured at 2025-12-21 GMT+8 23:16，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 3.5s / TBT 30ms / CLS 0 / SI 2.5s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 网络依赖关系树
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 23 KiB
    - 应避免出现长时间运行的主线程任务 发现了 2 项长时间运行的任务
    - 避免使用未合成的动画 发现了 1 个动画元素
- Accessibility
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。
- SEO
  - 文档缺少 meta 描述

**Desktop**

- 分数：P100 / A96 / BP96 / SEO92
- SEO
  - 文档缺少 meta 描述

### 6) `/en/docs/code-review-checklist`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-docs-code-review-checklist/9boq91mx40?form_factor=mobile`

**Mobile**

- 分数：P90 / A91 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:17，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 3.6s / TBT 10ms / CLS 0 / SI 2.3s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 网络依赖关系树
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 24 KiB
    - 应避免出现长时间运行的主线程任务 发现了 1 项长时间运行的任务
- Accessibility
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。

**Desktop**

- 分数：P100 / A96 / BP96 / SEO100
- 无（全部 > 95）

### 7) `/en/blog`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-blog/nz3kbfof7f?form_factor=mobile`

**Mobile**

- 分数：P67 / A93 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:18，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 8.5s / TBT 340ms / CLS 0 / SI 2.1s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 发现 LCP 请求
    - 网络依赖关系树
    - 改进图片传送 预计节省 80 KiB
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 667 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
- Accessibility
  - [aria-*] 属性缺少有效值
  - 文档缺少主要位置标记。
  - 图片元素没有属于多余文本的 [alt] 属性。

**Desktop**

- 分数：P88 / A86 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:18，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 1.6s / TBT 190ms / CLS 0.001 / SI 0.8s
  - 问题点：
    - 旧版 JavaScript 预计节省 14 KiB
    - 渲染屏蔽请求 预计缩短 80 毫秒
    - 发现 LCP 请求
    - 网络依赖关系树
    - 改进图片传送 预计节省 80 KiB
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 670 KiB
    - 应避免出现长时间运行的主线程任务 发现了 3 项长时间运行的任务
- Accessibility
  - [aria-*] 属性缺少有效值
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。

### 8) `/en/blog/what-is-xxx`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-blog-what-is-xxx/djiuxi8hrf?form_factor=mobile`

**Mobile**

- 分数：P71 / A95 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:18，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 5.6s / TBT 330ms / CLS 0.013 / SI 2.9s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 网络依赖关系树
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 664 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
- Accessibility
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。
  - 图片元素没有属于多余文本的 [alt] 属性。

**Desktop**

- 分数：P88 / A90 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:18，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 0.8s / TBT 280ms / CLS 0.033 / SI 1.0s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 80 毫秒
    - 强制自动重排
    - 网络依赖关系树
    - 旧版 JavaScript 预计节省 14 KiB
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 667 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
- Accessibility
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。

### 9) `/en/sign-in`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-sign-in/ygd4tar3b0?form_factor=mobile`

**Mobile**

- 分数：P94 / A95 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:19，模拟 Moto G 电源）
  - 指标：FCP 1.2s / LCP 3.0s / TBT 70ms / CLS 0 / SI 1.5s
  - 问题点：
    - 网络依赖关系树
    - 渲染屏蔽请求
    - 旧版 JavaScript 预计节省 14 KiB
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 519 KiB
    - 应避免出现长时间运行的主线程任务 发现了 3 项长时间运行的任务
- Accessibility
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。
  - 图片元素没有属于多余文本的 [alt] 属性。

**Desktop**

- 分数：P100 / A95 / BP96 / SEO100
- Accessibility
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。
  - 图片元素没有属于多余文本的 [alt] 属性。

### 10) `/en/sign-up`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-sign-up/2zpdnry4oi?form_factor=mobile`

**Mobile**

- 分数：P87 / A95 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:20，模拟 Moto G 电源）
  - 指标：FCP 1.2s / LCP 4.1s / TBT 80ms / CLS 0 / SI 1.8s
  - 问题点：
    - 网络依赖关系树
    - 渲染屏蔽请求
    - 旧版 JavaScript 预计节省 14 KiB
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 518 KiB
    - 应避免出现长时间运行的主线程任务 发现了 3 项长时间运行的任务
- Accessibility
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。
  - 图片元素没有属于多余文本的 [alt] 属性。

**Desktop**

- 分数：P95 / A95 / BP96 / SEO100
- Performance（Captured at 2025-12-21 GMT+8 23:20，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 0.6s / TBT 190ms / CLS 0 / SI 0.8s
  - 问题点：
    - 网络依赖关系树
    - 渲染屏蔽请求
    - 旧版 JavaScript 预计节省 14 KiB
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 519 KiB
    - 应避免出现长时间运行的主线程任务 发现了 3 项长时间运行的任务
- Accessibility
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。
  - 图片元素没有属于多余文本的 [alt] 属性。

### 11) `/en/privacy-policy`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-privacy-policy/o4ly1r4ina?form_factor=mobile`

**Mobile**

- 分数：P73 / A98 / BP96 / SEO69
- Performance（Captured at 2025-12-21 GMT+8 23:21，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 5.1s / TBT 350ms / CLS 0 / SI 2.2s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 网络依赖关系树
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 667 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
- SEO
  - 页面已被屏蔽，无法编入索引

**Desktop**

- 分数：P87 / A89 / BP96 / SEO69
- Performance（Captured at 2025-12-21 GMT+8 23:21，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 1.5s / TBT 240ms / CLS 0.001 / SI 0.8s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 80 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 网络依赖关系树
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 670 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
- Accessibility
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。
- SEO
  - 页面已被屏蔽，无法编入索引

### 12) `/en/terms-of-service`

- 报告链接：`https://pagespeed.web.dev/analysis/https-your-domain-com-en-terms-of-service/k4h2z4ohgh?form_factor=mobile`

**Mobile**

- 分数：P72 / A98 / BP96 / SEO69
- Performance（Captured at 2025-12-21 GMT+8 23:22，模拟 Moto G 电源）
  - 指标：FCP 1.4s / LCP 5.4s / TBT 350ms / CLS 0 / SI 2.0s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 300 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 网络依赖关系树
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 667 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
- SEO
  - 页面已被屏蔽，无法编入索引

**Desktop**

- 分数：P90 / A89 / BP96 / SEO69
- Performance（Captured at 2025-12-21 GMT+8 23:22，模拟桌面设备）
  - 指标：FCP 0.3s / LCP 1.0s / TBT 230ms / CLS 0.001 / SI 1.1s
  - 问题点：
    - 渲染屏蔽请求 预计缩短 80 毫秒
    - 旧版 JavaScript 预计节省 14 KiB
    - 网络依赖关系树
    - 布局偏移原因
    - LCP 细分
    - 减少未使用的 JavaScript 预计节省 671 KiB
    - 应避免出现长时间运行的主线程任务 发现了 4 项长时间运行的任务
- Accessibility
  - 按钮缺少可供访问的名称
  - 图片元素没有属于多余文本的 [alt] 属性。
  - 背景色和前景色没有足够高的对比度。
  - 文档缺少主要位置标记。
  - 相同链接的用途一致。
- SEO
  - 页面已被屏蔽，无法编入索引

## 总结（共性问题与优先级建议）

### P0（影响最大 / 多页面复现）

- 性能：**大量未使用的 JavaScript（~500–670 KiB）**、**渲染屏蔽请求**、**网络依赖关系树过长**、**LCP 细分异常（移动端 LCP 常在 5–9s）**、**长任务/主线程工作量过高**。
- 无障碍：**图片缺少 `alt`**、**对比度不足**、**缺少主要位置标记（建议 `<main>` / `role=\"main\"`）**、**按钮缺少可访问名称**、**部分页面 ARIA 属性值无效**。
- SEO：`/en/docs*` **缺少 meta 描述**；`/en/privacy-policy` 与 `/en/terms-of-service` **被标记为不可索引（SEO=69）**。

### P1（按模块推进）

- 图片与 LCP：对首屏大图/关键资源使用 `next/image`（含 `sizes`）、启用现代格式（AVIF/WebP）、合理 `priority`、减少首屏第三方与 JS 执行开销。
- JS 体积：拆分路由级 bundle、对重组件/编辑器/markdown/高亮等做动态加载、清理未使用依赖、减少重复 JS。
- 渲染阻塞：关键 CSS 直出/按需加载，延后非关键脚本，检查字体加载策略（`next/font`、`font-display`）。
- 布局偏移：为图片/媒体设置明确 `width/height` 或容器占位，避免 late-insert 内容引发 CLS。

## 修复进展（2025-12-22）

> 本节为“本仓库修复落地”记录；PSI 分数存在波动，建议以相同网络/设备条件复测验证。

- 性能（P1 落地）：
  - `SmartIcon`：移除动态 import 全量 icon 包，改为白名单静态映射以降低未使用 JS（对应“减少未使用的 JavaScript / 缩短 JavaScript 执行用时”）。
  - `ScrollAnimation`：移除 `framer-motion` 依赖实现，改为 `IntersectionObserver + CSS transition`，以降低主线程工作量并减少非合成动画命中风险。
  - Hero 图片：为首屏关键图补齐 `sizes` 并在确定唯一资源时启用 `priority`（避免误用导致多图 preload）。
- 无障碍（P1 落地）：
  - `main landmark`：在 landing 与 docs 布局加入 `<main role="main">`。
  - `alt`：为多个 `next/image`/`LazyImage` 场景补齐非空 fallback `alt`（logo/avatar/卡片图）。
  - `按钮可访问名称`：为 icon-only 的主题切换与语言切换按钮补齐 `aria-label`。
  - `对比度`：提升 `--muted-foreground`（并略微加深 `--primary`）以减少低对比度命中概率。

验证记录：见 `.codex/plan/fix-pagespeed-issues.md`

### P2（治理与防回归）

- 为关键页面建立 Lighthouse/PSI 基线（CI 或定期巡检），以 **Performance / Accessibility / SEO ≥ 95** 为门槛。
- 对 `robots` / `X-Robots-Tag` / 页面级 `noindex` 做显式策略（避免误伤需要公开索引的页面）。
