import type { Metadata } from "next";
import { ProjectShowcase } from "../components/ProjectShowcase";
import { SignalButton } from "../components/SignalButton";

export const metadata: Metadata = {
  title: "Selected Work — MORPH//LAB",
  description:
    "Four real MORPH//LAB projects across persona systems, digital portfolios, emotional interaction devices and AI design workflows.",
  alternates: { canonical: "/work" },
};

export default function WorkPage() {
  return (
    <main id="main-content" className="inner-page">
      <header className="page-hero page-shell">
        <div className="section-kicker">
          <span>INDEX / 01</span>
          <span>SELECTED WORK</span>
        </div>
        <h1 data-motion-mask>SYSTEMS FOR<br />UNFAMILIAR QUESTIONS.</h1>
        <div className="page-hero__support" data-motion-reveal>
          <p>四个真实项目，分别处理人格系统、数字作品集、情绪交互装置与 AI 设计工作流。</p>
          <p>
            每个项目都从具体问题出发：先建立清楚的内容规则，再决定界面、动效、生成能力与硬件如何参与。
          </p>
        </div>
      </header>

      <section className="work-index" aria-label="Selected projects">
        <ProjectShowcase />
      </section>

      <section className="work-method page-section page-shell" aria-labelledby="method-title">
        <p className="section-label">METHOD / SHARED RULES</p>
        <div className="section-heading-grid">
          <h2 id="method-title" data-motion-mask>DIFFERENT OUTPUTS.<br />ONE STANDARD.</h2>
          <p data-motion-reveal>
            无论最终形态是档案、图鉴还是操作台，所有系统都要保持内容可读、交互可解释、性能可降级、结果可部署。
          </p>
        </div>
        <ol className="method-list">
          <li><span>01</span><strong>Content before effects</strong><p>先确定用户需要理解什么，再设计视觉事件。</p></li>
          <li><span>02</span><strong>Motion with a reason</strong><p>每个运动都对应状态、层级或叙事变化。</p></li>
          <li><span>03</span><strong>Fallback is a feature</strong><p>低性能设备得到更轻的体验，而不是残缺体验。</p></li>
          <li><span>04</span><strong>Prototype in reality</strong><p>用可运行版本验证判断，不用静态想象替代反馈。</p></li>
        </ol>
      </section>

      <section className="page-next page-shell">
        <p>HAVE A QUESTION THAT NEEDS ITS OWN SYSTEM?</p>
        <SignalButton href="/contact">Start a conversation</SignalButton>
      </section>
    </main>
  );
}
