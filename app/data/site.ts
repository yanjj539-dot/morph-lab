export interface Capability {
  id: string;
  index: string;
  title: string;
  titleZh: string;
  description: string;
  detail: string;
  tags: string[];
  icon: "direction" | "interaction" | "identity" | "frontend" | "workflow" | "prototype";
}

export interface Project {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  imageAlt: string;
  services: string[];
  year: string;
  ratio: "landscape" | "portrait" | "wide";
}

export const processSteps = [
  {
    index: "01",
    title: "Decode",
    titleZh: "解码问题",
    description: "理解内容、用户、限制与真正需要改变的结果。",
  },
  {
    index: "02",
    title: "Construct",
    titleZh: "建立系统",
    description: "把判断转化为视觉语言、信息结构与可复用规则。",
  },
  {
    index: "03",
    title: "Animate",
    titleZh: "组织运动",
    description: "用节奏、反馈和空间关系解释信息，而不是装饰信息。",
  },
  {
    index: "04",
    title: "Deploy",
    titleZh: "投入运行",
    description: "将概念交付为可访问、可维护、可验证的数字产品。",
  },
] as const;

export const capabilities: Capability[] = [
  {
    id: "visual-direction",
    index: "01",
    title: "AI Visual Direction",
    titleZh: "AI 视觉方向",
    description: "让生成能力服从明确的审美判断。",
    detail:
      "从素材语法、构图系统到批量生成规则，建立可持续复用的视觉方向，而不是依赖偶然的单张结果。",
    tags: ["ART DIRECTION", "GEN SYSTEM"],
    icon: "direction",
  },
  {
    id: "interactive-web",
    index: "02",
    title: "Interactive Web Design",
    titleZh: "交互网页设计",
    description: "让滚动、状态与内容形成连续叙事。",
    detail:
      "用响应式布局、动效时间线和可访问交互构建具备作品感、同时能够真实投入使用的品牌体验。",
    tags: ["UX", "MOTION"],
    icon: "interaction",
  },
  {
    id: "generative-identity",
    index: "03",
    title: "Generative Identity",
    titleZh: "生成式识别系统",
    description: "把品牌从静态标志扩展成一套行为规则。",
    detail:
      "以变量、约束与实时输入定义视觉身份，使每次输出保持一致性，同时保留足够的变化空间。",
    tags: ["IDENTITY", "VARIABLE"],
    icon: "identity",
  },
  {
    id: "creative-frontend",
    index: "04",
    title: "Creative Frontend",
    titleZh: "创意前端",
    description: "在设计精度与工程质量之间建立同一套标准。",
    detail:
      "从语义 HTML、设计令牌到 Canvas、WebGL 与性能降级，让视觉概念能够稳定构建、部署和维护。",
    tags: ["TYPESCRIPT", "WEBGL"],
    icon: "frontend",
  },
  {
    id: "agent-workflow",
    index: "05",
    title: "Agent Workflow Design",
    titleZh: "Agent 工作流设计",
    description: "把重复操作重构为可观察、可接管的流程。",
    detail:
      "为素材整理、内容维护与设计生产搭建人机协同链路，保留审批节点、质量门槛与失败恢复。",
    tags: ["AGENT", "AUTOMATION"],
    icon: "workflow",
  },
  {
    id: "prototyping",
    index: "06",
    title: "Experimental Prototyping",
    titleZh: "实验性原型",
    description: "用小而完整的原型验证未知体验。",
    detail:
      "针对新交互、生成逻辑和空间界面快速建立可运行原型，以真实反馈替代抽象讨论。",
    tags: ["PROTOTYPE", "RESEARCH"],
    icon: "prototype",
  },
];

export const projects: Project[] = [
  {
    id: "synthetic-memory-archive",
    index: "01",
    title: "Synthetic Memory Archive",
    subtitle: "合成记忆档案",
    description:
      "一个将照片、声音与文字重新编排为可探索时间层的数字档案。AI 负责发现关联，观看者决定记忆如何被阅读。",
    image: "/images/project-memory",
    imageAlt:
      "深色数字档案工作台上叠放着半透明记忆面板、低饱和照片碎片和扫描时间轴",
    services: ["AI DIRECTION", "ARCHIVE UX", "INTERACTION"],
    year: "2026",
    ratio: "landscape",
  },
  {
    id: "emotional-species-atlas",
    index: "02",
    title: "Emotional Species Atlas",
    subtitle: "情绪物种图鉴",
    description:
      "把行为与情绪信号转译成不断演化的抽象物种。每个标本不是人格标签，而是一段可被观察的关系。",
    image: "/images/project-species",
    imageAlt:
      "实验档案中的抽象情绪标本，由半透明薄膜、石墨丝线和蓝色精密节点组成",
    services: ["GENERATIVE ART", "DATA POETICS", "WEBGL"],
    year: "2026",
    ratio: "portrait",
  },
  {
    id: "autonomous-design-operator",
    index: "03",
    title: "Autonomous Design Operator",
    subtitle: "自主设计操作员",
    description:
      "一个帮助设计团队整理素材、生成版式和维护内容的 Agent 工作台。自动化负责周转，人保留最终判断。",
    image: "/images/project-operator",
    imageAlt:
      "深色设计工作台上分布着模块化任务轨道、流程节点、材料样本和实时状态灯",
    services: ["AGENT UX", "SYSTEM DESIGN", "FRONTEND"],
    year: "2026",
    ratio: "wide",
  },
];

export const faqs = [
  {
    question: "你们只做视觉设计吗？",
    answer:
      "不是。视觉只是系统的一层。我们同时处理信息结构、交互逻辑、动效、前端实现与上线后的可维护性。",
  },
  {
    question: "AI 在项目中具体参与什么？",
    answer:
      "它可以参与研究整理、视觉探索、内容变体和生产自动化，但方向、取舍、质量判断与最终责任由人承担。",
  },
  {
    question: "是否可以完成从设计到前端开发？",
    answer:
      "可以。我们偏好从概念到部署保持同一套设计标准，让交互细节不会在交接中被稀释。",
  },
  {
    question: "可以制作 Three.js 和创意动效吗？",
    answer:
      "可以。我们会先判断 3D 或动效是否真正服务叙事，再为桌面、移动端与低性能设备设计分级体验。",
  },
  {
    question: "项目通常如何开始？",
    answer:
      "从一次目标解码开始：确认受众、内容、限制、成功标准和最值得验证的风险，再决定原型的最小完整形态。",
  },
  {
    question: "是否接受实验性学生项目合作？",
    answer:
      "接受方向清晰、愿意共同研究并能形成真实输出的合作。请在来信中说明问题、已有材料与希望验证的假设。",
  },
] as const;

