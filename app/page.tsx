/* Static <img> URLs are base-path-prefixed explicitly for GitHub Pages. */
/* eslint-disable @next/next/no-img-element */
import { ProjectShowcase } from "./components/ProjectShowcase";
import ScrollJourney from "./components/ScrollJourney";
import { SignalButton } from "./components/SignalButton";
import { aboutPoints, practices, projects } from "./data/site";
import { withBasePath } from "./lib/paths";

export default function Home() {
  return (
    <main id="main-content">
      <section className="hero hero--editorial" aria-labelledby="hero-title">
        <div className="page-shell hero-grid">
          <div className="hero-kicker" data-motion-reveal>
            <span>MORPH//LAB</span>
            <span>AI DESIGN / INTERACTIVE SYSTEMS</span>
          </div>
          <div className="hero-copy">
            <h1 id="hero-title" data-motion-mask>
              <span>DESIGN, SYSTEMS,</span>
              <span>AND DIGITAL EXPERIMENTS.</span>
            </h1>
            <div className="hero-support" data-motion-reveal>
              <p className="hero-title-zh">把模型、界面与视觉实验，做成真正可以运行的作品。</p>
              <p className="hero-description">
                一个小型创意实验室，连接 AI 视觉系统、交互网页、实体原型和可部署的前端工程。
              </p>
              <div className="hero-actions">
                <SignalButton href="#practice">See the practice</SignalButton>
                <SignalButton href="#selected-work" variant="line">View real work</SignalButton>
              </div>
            </div>
          </div>
          <div className="hero-composition">
            <figure className="hero-art" data-motion-reveal>
              <img
                src={withBasePath("/images/morph-hero-materials-v1.webp")}
                alt="纸张、界面原型、蓝色校准件和硬件组件组成的 MORPH//LAB 实验材料台概念配图"
                width={1600}
                height={1000}
                loading="eager"
                fetchPriority="high"
              />
              <figcaption>
                <span>LAB PLATE / 001</span>
                <span>HUMAN-CURATED STUDY</span>
              </figcaption>
            </figure>
            <div className="hero-card hero-card--note">
              <span>Observe</span>
              <p>materials / constraints / tone</p>
            </div>
            <div className="hero-card hero-card--system">
              <span>Structure</span>
              <p>rules / layout / rhythm</p>
            </div>
            <div className="hero-card hero-card--release">
              <span>Release</span>
              <p>browser QA / deploy / iterate</p>
            </div>
          </div>
          <a className="scroll-cue" href="#process">
            <span>SCROLL THROUGH THE PROCESS</span>
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <ScrollJourney />

      <section className="practice page-section page-shell" id="practice" aria-labelledby="practice-title">
        <div className="section-kicker" data-motion-reveal>
          <span>02 / PRACTICE</span>
          <span>REAL OUTPUTS / RUNNING SYSTEMS</span>
        </div>
        <div className="section-heading-grid">
          <h2 id="practice-title" data-motion-mask>WHAT I ACTUALLY MAKE</h2>
          <p data-motion-reveal>
            不把 AI 当成视觉标签，而是把它接入明确的设计判断、可测试界面和可交付工作流。
          </p>
        </div>
        <div className="practice-grid">
          {practices.map((item, index) => (
            <article className="practice-card" key={item.title} data-motion-reveal>
              <span className="practice-card__index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p className="practice-card__zh">{item.titleZh}</p>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="selected-work page-section" id="selected-work" aria-labelledby="work-title">
        <div className="page-shell">
          <div className="section-kicker" data-motion-reveal>
            <span>03 / SELECTED WORK</span>
            <span>{String(projects.length).padStart(2, "0")} REAL PROJECTS</span>
          </div>
          <div className="section-heading-grid">
            <h2 id="work-title" data-motion-mask>SELECTED WORK, BUILT FROM REAL MATERIALS.</h2>
            <p data-motion-reveal>
              这里不放虚构案例。每个项目都来自已经存在的界面、图像、硬件原型或工作流实践。
            </p>
          </div>
        </div>
        <ProjectShowcase />
      </section>

      <section className="about page-section page-shell" id="about" aria-labelledby="about-title">
        <div className="about-grid">
          <div>
            <p className="section-label" data-motion-reveal>04 / ABOUT</p>
            <h2 id="about-title" data-motion-mask>A SMALL LAB FOR REAL DIGITAL EXPERIMENTS.</h2>
          </div>
          <div className="about-copy" data-motion-reveal>
            {aboutPoints.map((point) => (
              <p key={point}>{point}</p>
            ))}
            <SignalButton href="/studio" variant="line">Read the studio notes</SignalButton>
          </div>
        </div>
        <dl className="lab-metrics" aria-label="MORPH//LAB working focus">
          <div data-motion-reveal><dt>65</dt><dd>PERSONAS STRUCTURED</dd></div>
          <div data-motion-reveal><dt>08</dt><dd>PERSONA FAMILIES</dd></div>
          <div data-motion-reveal><dt>04</dt><dd>DIGITAL WEB DIRECTIONS</dd></div>
          <div data-motion-reveal><dt>ESP32</dt><dd>PHYSICAL INTERACTION LOOP</dd></div>
        </dl>
      </section>

      <section className="final-cta final-cta--paper" aria-labelledby="cta-title">
        <div className="page-shell final-cta__inner">
          <p className="section-label" data-motion-reveal>05 / NEXT RELEASE</p>
          <h2 id="cta-title" data-motion-mask>LET&apos;S MAKE THE NEXT ONE REAL.</h2>
          <p data-motion-reveal>
            带着一个问题、一组材料，或一个还没完全成形的想法开始。目标是把它做成可运行的作品。
          </p>
          <SignalButton href="/contact" className="final-cta__button">START A CONVERSATION</SignalButton>
        </div>
      </section>
    </main>
  );
}
