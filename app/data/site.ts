import { withBasePath } from "../lib/paths";

export interface ProjectAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
  tone?: "paper" | "blue" | "coral";
}

export interface Project {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  description: string;
  assets: ProjectAsset[];
  services: string[];
  year: string;
  ratio: "landscape" | "portrait" | "wide";
  evidence: string[];
}

export const practices = [
  {
    title: "AI visual systems",
    titleZh: "AI 视觉系统",
    description: "为批量图像、人格视觉和品牌语气建立明确约束，让生成结果保持同一套审美判断。",
  },
  {
    title: "Interactive websites",
    titleZh: "交互网站",
    description: "把作品集、产品页和研究笔记做成可以浏览、可以部署、可以复用的数字界面。",
  },
  {
    title: "Physical interaction prototypes",
    titleZh: "实体交互原型",
    description: "用 ESP32、传感器、声音与光效，把情绪反馈和硬件行为接到真实体验里。",
  },
  {
    title: "Agent-assisted workflow",
    titleZh: "Agent 辅助工作流",
    description: "让模型参与整理、初稿、检查和交付，但保留人的方向判断和质量门槛。",
  },
] as const;

export const workflowSteps = [
  "Material intake",
  "Model-assisted structure",
  "Human design judgement",
  "Prototype / browser QA",
  "Release package",
] as const;

export const projects: Project[] = [
  {
    id: "abstract-persona-system",
    index: "01",
    title: "Abstract Persona System",
    subtitle: "65 personas / 8 families",
    description:
      "一套把人格、语气、颜色和视觉标本组织成可浏览系统的实验。重点不是给人贴标签，而是建立一组可以比较、筛选和延展的抽象角色。",
    assets: [
      {
        src: withBasePath("/images/persona-home.webp"),
        alt: "Abstract Persona System 的移动端首页界面",
        width: 900,
        height: 1600,
        tone: "paper",
      },
      {
        src: withBasePath("/images/persona-result.webp"),
        alt: "Abstract Persona System 的人格结果海报",
        width: 1200,
        height: 1600,
        tone: "coral",
      },
    ],
    services: ["PERSONA SYSTEM", "VISUAL TAXONOMY", "MOBILE UI"],
    year: "2026",
    ratio: "portrait",
    evidence: ["65 personas", "8 families", "result poster system"],
  },
  {
    id: "digital-portfolio-experiments",
    index: "02",
    title: "Digital Portfolio Experiments",
    subtitle: "Aeroform / Field Notes / Smoke Fruit Sauce / Units",
    description:
      "多个小型网页作品的连续实验：从产品感封面、笔记型内容、食品品牌页面到单位换算工具，验证不同内容如何形成自己的界面节奏。",
    assets: [
      {
        src: withBasePath("/images/web-aeroform.webp"),
        alt: "Aeroform 作品封面",
        width: 1600,
        height: 1000,
        tone: "paper",
      },
      {
        src: withBasePath("/images/web-field-notes.webp"),
        alt: "Field Notes 作品封面",
        width: 1600,
        height: 1000,
        tone: "blue",
      },
      {
        src: withBasePath("/images/web-smoke-fruit.webp"),
        alt: "Smoke Fruit Sauce 作品封面",
        width: 1600,
        height: 1000,
        tone: "coral",
      },
      {
        src: withBasePath("/images/web-units.webp"),
        alt: "Units 工具作品封面",
        width: 1600,
        height: 1000,
        tone: "blue",
      },
    ],
    services: ["WEB DESIGN", "FRONTEND", "EDITORIAL SYSTEM"],
    year: "2026",
    ratio: "wide",
    evidence: ["Aeroform", "Field Notes", "Smoke Fruit Sauce", "Units"],
  },
  {
    id: "emotional-interaction-device",
    index: "03",
    title: "Emotional Interaction Device",
    subtitle: "ESP32 / light ring / sensors / sound",
    description:
      "一个围绕情绪输入与柔性反馈制作的实体交互原型。ESP32 连接光环、传感器与声音反馈，让数字情绪不只停留在屏幕上。",
    assets: [
      {
        src: withBasePath("/images/device-tree-hole.webp"),
        alt: "情绪互动装置的硬件结构与展示图",
        width: 1600,
        height: 1000,
        tone: "paper",
      },
    ],
    services: ["ESP32", "SENSOR FEEDBACK", "SOUND + LIGHT"],
    year: "2026",
    ratio: "landscape",
    evidence: ["ESP32 prototype", "light ring", "sensor input", "sound feedback"],
  },
  {
    id: "ai-design-workflow",
    index: "04",
    title: "AI Design Workflow",
    subtitle: "from materials to reviewed release",
    description:
      "一条把资料理解、模型辅助、人工判断、浏览器质检和部署打通的工作流。AI 负责加速周转，人负责边界、取舍和最终质量。",
    assets: [
      {
        src: withBasePath("/images/morph-workflow-quality-gate-v1.webp"),
        alt: "材料输入、结构整理、人工评审、浏览器质检与发布包组成的五阶段 AI 设计工作流概念配图",
        width: 1600,
        height: 1000,
        tone: "blue",
      },
    ],
    services: ["AGENT WORKFLOW", "QA LOOP", "DEPLOYMENT"],
    year: "2026",
    ratio: "wide",
    evidence: ["material intake", "human review", "browser QA", "release"],
  },
];

export const aboutPoints = [
  "MORPH//LAB 关注模型、界面、视觉系统和实体交互之间的连接。",
  "项目尺度保持小而完整：先判断，再组织，再原型，最后交付可以运行的版本。",
  "审美目标不是制造 AI 感，而是让技术退到体验之后。",
] as const;
