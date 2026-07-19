import type { Metadata } from "next";
import { SignalButton } from "../components/SignalButton";

export const metadata: Metadata = {
  title: "Studio — MORPH//LAB",
  description:
    "The MORPH//LAB position on AI, design judgment, interaction and precise experimentation.",
  alternates: { canonical: "/studio" },
};

const principles = [
  ["01", "Judgment before generation", "生成可以更快，但方向必须先被说明、比较与选择。"],
  ["02", "Systems before volume", "我们更愿意建立可复用规则，而不是一次性制造更多输出。"],
  ["03", "Behavior before decoration", "动效首先解释状态与关系，其次才提供气氛。"],
  ["04", "Reality before presentation", "真实运行、真实设备和真实限制，是设计的一部分。"],
] as const;

export default function StudioPage() {
  return (
    <main id="main-content" className="inner-page">
      <header className="page-hero page-shell studio-hero">
        <div className="section-kicker">
          <span>INDEX / 02</span>
          <span>INDEPENDENT DESIGN LAB</span>
        </div>
        <h1 data-motion-mask>A SMALL LAB<br />FOR PRECISE<br />EXPERIMENTS.</h1>
        <div className="page-hero__support" data-motion-reveal>
          <p>规模不需要很大，判断需要足够准确。</p>
          <p>
            MORPH//LAB 将人工智能、视觉设计、交互体验与创意技术放在同一个工作台上，保持从概念到前端实现的连续性。
          </p>
        </div>
      </header>

      <section className="studio-statement page-section page-shell" aria-labelledby="position-title">
        <p className="section-label">POSITION / 2026</p>
        <h2 id="position-title" data-motion-mask>WE DO NOT DESIGN<br />A LOOK OF THE FUTURE.</h2>
        <div className="studio-statement__copy" data-motion-reveal>
          <p>我们设计现在可以被使用的系统。</p>
          <p>
            AI 不应成为统一的视觉风格。它是一种材料、协作者和生产能力；真正决定作品是否成立的，仍然是内容判断、结构选择与细节控制。
          </p>
        </div>
      </section>

      <section className="principles page-section page-shell" aria-labelledby="principles-title">
        <div className="section-kicker">
          <span>WORKING PRINCIPLES</span>
          <span>04 RULES</span>
        </div>
        <h2 id="principles-title" className="sr-only">Working principles</h2>
        <ol>
          {principles.map(([index, title, description]) => (
            <li key={index} data-motion-reveal>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="studio-lab-note page-section page-shell" aria-labelledby="lab-note-title">
        <div className="section-heading-grid">
          <div>
            <p className="section-label">LAB STATE</p>
            <h2 id="lab-note-title" data-motion-mask>SMALL ENOUGH<br />TO STAY SPECIFIC.</h2>
          </div>
          <div className="studio-lab-note__copy" data-motion-reveal>
            <p>
              The lab is intentionally independent: project shape follows the question, not a fixed service menu.
            </p>
            <p>
              工作方式保持轻量，但判断不轻量。每次合作都会先定义材料、约束、可验证结果与上线后的真实使用情境。
            </p>
          </div>
        </div>
      </section>

      <section className="privacy page-section page-shell" id="privacy" aria-labelledby="privacy-title">
        <div className="section-heading-grid">
          <h2 id="privacy-title">PRIVACY, BY DEFAULT.</h2>
          <div>
            <p>本站不放置广告跟踪器，不建立跨站画像，也不在表单中保存你的内容。</p>
            <p>联系表单只会在你的设备上生成一封邮件，由你决定是否发送。</p>
          </div>
        </div>
      </section>

      <section className="page-next page-shell">
        <p>THE NEXT EXPERIMENT STARTS WITH A CLEAR QUESTION.</p>
        <SignalButton href="/contact">Bring a question</SignalButton>
      </section>
    </main>
  );
}
