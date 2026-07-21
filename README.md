# MORPH//LAB

MORPH//LAB（形态智能实验室）是一个围绕 AI 设计、交互系统与数字实验构建的独立创意实验室网站。

站点采用天蓝、纸白、钴蓝与珊瑚红的编辑式视觉系统。桌面端通过 Three.js 与 ScrollTrigger 呈现 `Observe / Structure / Prototype / Release` 四阶段滚动旅程；移动端与减少动态效果模式使用轻量静态场景和原生纵向阅读。

## 页面

- `/`：Hero、四阶段流程、实践方向、真实项目、About 与 CTA
- `/work`：Abstract Persona System、Digital Portfolio Experiments、Emotional Interaction Device、AI Design Workflow
- `/studio`：实验室立场、工作原则与隐私说明
- `/contact`：项目说明与本地邮件撰写表单

## 技术

- Next.js / React / TypeScript
- vinext / Vite / Cloudflare Workers
- Three.js / GSAP / ScrollTrigger / Lenis
- GitHub Pages 仓库子路径静态导出

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

质量检查：

```bash
npm run lint
npx tsc --noEmit
npm run test:round2
npm test
```

完整浏览器质检会生成四阶段截图、七视口截图、桌面/移动录屏、Canvas 像素统计与 Lighthouse 报告：

```bash
npx playwright install chromium
npm run qa:round2
```

结果写入 `artifacts/qa-round2/`。桌面 3D 仅在 `min-width: 1024px`、允许动态效果且 WebGL 可用时加载；移动端、Reduced Motion 与加载失败路径使用四张 Blender 静态关键帧。

GitHub Pages 静态构建：

```bash
GITHUB_PAGES=true \
GITHUB_REPOSITORY=yanjj539-dot/morph-lab \
NEXT_PUBLIC_SITE_URL=https://yanjj539-dot.github.io/morph-lab \
npm run build:pages
```

静态产物输出到 `out/`。当前站点从 `gh-pages` 分支根目录发布，`main` 保留完整源码。
