import { withBasePath } from "../lib/paths";

export type JourneyStageId = "observe" | "structure" | "prototype" | "release";

export type JourneyStage = {
  id: JourneyStageId;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  details: readonly string[];
  labelText: string;
  fallbackSrc: string;
};

export const JOURNEY_STAGE_PROGRESS = [0.08, 0.36, 0.63, 0.9] as const;

export const JOURNEY_STAGES: readonly JourneyStage[] = [
  {
    id: "observe",
    label: "01",
    eyebrow: "OBSERVE",
    title: "把材料看清楚",
    body: "先拆解真实内容、语气、视觉资产和使用场景，不急着套模板。",
    details: ["content audit", "reference map", "interaction notes"],
    labelText: "01 / OBSERVE",
    fallbackSrc: withBasePath("/fallback/round-2/observe.webp"),
  },
  {
    id: "structure",
    label: "02",
    eyebrow: "STRUCTURE",
    title: "建立可以生长的系统",
    body: "把模型输出、界面层级、组件节奏和品牌语言整理成可执行结构。",
    details: ["information architecture", "design tokens", "component rhythm"],
    labelText: "02 / STRUCTURE",
    fallbackSrc: withBasePath("/fallback/round-2/structure.webp"),
  },
  {
    id: "prototype",
    label: "03",
    eyebrow: "PROTOTYPE",
    title: "做出可运行的试验品",
    body: "用前端、WebGL、传感器或自动化流程快速验证交互是否成立。",
    details: ["live interface", "motion test", "device loop"],
    labelText: "03 / PROTOTYPE",
    fallbackSrc: withBasePath("/fallback/round-2/prototype.webp"),
  },
  {
    id: "release",
    label: "04",
    eyebrow: "RELEASE",
    title: "收束成正式作品",
    body: "删除装饰性噪音，保留叙事、性能、可访问性和可部署结果。",
    details: ["production build", "browser QA", "deployment notes"],
    labelText: "04 / RELEASE",
    fallbackSrc: withBasePath("/fallback/round-2/release.webp"),
  },
] as const;
