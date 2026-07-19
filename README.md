# MORPH//LAB

MORPH//LAB（形态智能实验室）是一个原创的 AI × 设计 × 交互实验室官网。站点以工业编辑式排版、克制滚动叙事、实时 Three.js 形态核心和可操作 Canvas 实验构成完整品牌体验。

## 页面

- `/`：Hero 3D、宣言、流程、能力系统、精选项目、实时生成系统、关于、FAQ 与 CTA。
- `/work`：三个实验项目与共用方法论。
- `/studio`：工作室立场、原则、数据与隐私说明。
- `/contact`：项目信息与本地邮件撰写表单。

## 技术结构

```text
app/
├─ components/        # 3D、Canvas、导航、动效、手风琴、表单等组件
├─ contact/page.tsx
├─ data/site.ts       # 项目、能力、流程与 FAQ 内容数据
├─ studio/page.tsx
├─ work/page.tsx
├─ globals.css        # 设计令牌、栅格、响应式与动效样式
├─ layout.tsx         # 全局元数据、结构化数据与站点外壳
└─ page.tsx           # 首页叙事结构
public/
├─ images/            # AVIF / WebP / JPEG 项目图
├─ og.png
└─ favicon.png
scripts/
└─ prepare_generated_assets.py
```

站点使用 TypeScript、React、vinext/Vite、Three.js、GSAP、ScrollTrigger、Lenis、Canvas 2D、Lucide 与 CSS Custom Properties。Cloudflare Sites 配置位于 `.openai/hosting.json`。

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
npm run build
npm run start
```

质量检查：

```bash
npm run lint
npx tsc --noEmit
npm test
```

## 核心交互

- Hero 的 Three.js 核心会响应鼠标轻视差、滚动解构和 CTA 信号增强。
- 桌面端使用 Lenis；移动端与 reduced-motion 使用原生滚动。
- GSAP/ScrollTrigger 只驱动遮罩、透明度、轻位移和 3%–6% 图片缩放。
- 能力与 FAQ 均为单开手风琴，包含完整 ARIA 状态。
- 移动导航支持焦点陷阱、Esc 关闭、焦点恢复和背景滚动锁定。
- LIVE GENERATIVE SYSTEM 支持鼠标、点击/触摸、Enter/Space 和 Reset。

## 素材替换

每个项目图使用同名三格式文件：

```text
public/images/project-memory.{avif,webp,jpg}
public/images/project-species.{avif,webp,jpg}
public/images/project-operator.{avif,webp,jpg}
```

替换源图后，可使用 Pillow 运行 `scripts/prepare_generated_assets.py`，它会裁切为固定比例并输出 AVIF、WebP、JPEG、Open Graph 图与图标。页面中的文案、比例、alt 和服务标签集中在 `app/data/site.ts`。

## 响应式与无障碍

- 桌面：完整 Three.js、Lenis、sticky 流程和项目自定义光标。
- 平板：减少几何数量、DPR 和 sticky 高度。
- 移动：4 栏逻辑、原生滚动、无自定义光标、无横向滚动、简化 3D。
- 支持 Skip to content、键盘焦点、语义标题、ARIA accordion、Canvas 文本替代和 `prefers-reduced-motion`。

## 性能策略

- Three.js、GSAP、ScrollTrigger 与 Lenis 都通过动态导入延后加载。
- Three.js DPR 上限为 1.75；移动端进一步降低。
- Canvas/WebGL 离屏或页面隐藏时暂停；所有监听、RAF、材质和几何体均清理。
- 项目图明确尺寸，首张优先加载，其余 lazy loading，并提供 AVIF/WebP fallback。
- 首屏文本不依赖 WebGL，WebGL 不可用时保留静态结构降级。

## SEO 与部署

站点包含独立页面标题/描述、canonical、Open Graph、Twitter Card、favicon、`robots.txt`、`sitemap.xml`、Organization 与 WebSite Schema。

生产构建：

```bash
npm run build
```

构建结果兼容 Cloudflare Worker ESM，可通过 OpenAI Sites 发布；也可按目标平台的 Node/Worker 适配方式部署。

## 已知限制

- 项目为概念实验室站点，邮箱与项目数据为品牌示例，应在真实上线前替换。
- Three.js 是延迟加载的独立大模块；低端设备会简化，但仍建议在真实目标设备上做性能抽样。
- 联系表单不在服务器保存数据，只在设备上打开邮件应用。

## 可继续扩展

- 为三个项目增加独立 CreativeWork 详情页。
- 接入真实邮箱/API、作品 CMS 与多语言路由。
- 为 Three.js 核心增加压缩 GLB 与设备分级资源。
- 增加真实 GitHub、Behance、小红书等社交账号。

