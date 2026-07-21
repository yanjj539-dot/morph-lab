/* Static <img> URLs are base-path-prefixed explicitly for GitHub Pages. */
/* eslint-disable @next/next/no-img-element */
import { ArrowDownRight } from "lucide-react";
import { ProjectShowcase } from "./components/ProjectShowcase";
import ScrollJourney from "./components/ScrollJourney";
import { SignalButton } from "./components/SignalButton";
import { aboutPoints, practices, projects } from "./data/site";
import { withBasePath } from "./lib/paths";

export default function Home() {
  return (
    <main id="main-content">
      <section
        className="hero hero--editorial"
        aria-labelledby="hero-title"
        data-header-theme="light"
      >
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
                src={withBasePath("/fallback/round-3/observe.webp")}
                alt="MORPH//LAB Observe 阶段的 Blender 工作台，包含输入材料、扫描组件与项目界面"
                width={1600}
                height={1000}
                loading="eager"
                fetchPriority="high"
              />
              <figcaption>
                <span>SCENE PLATE / OBSERVE</span>
                <span>BLENDER-AUTHORED / REAL-TIME MATCH</span>
              </figcaption>
            </figure>
          </div>
          <a className="scroll-cue" href="#process">
            <span>SCROLL THROUGH THE PROCESS</span>
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <ScrollJourney />

      <section
        className="practice page-section page-shell"
        id="practice"
        aria-labelledby="practice-title"
        data-nav-section="process"
        data-header-theme="light"
      >
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
        <div className="practice-list">
          {practices.map((item, index) => (
            <a
              className="practice-row"
              href={`#${item.projectId}`}
              key={item.title}
              data-motion-reveal
              aria-label={`${item.titleZh}：查看对应项目`}
            >
              <span className="practice-row__rail" aria-hidden="true">
                <span className="practice-row__index">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <figure className="practice-row__visual">
                <img
                  src={item.image.src}
                  alt={item.image.alt}
                  width={item.image.width}
                  height={item.image.height}
                  loading="lazy"
                  style={{ objectPosition: item.image.position }}
                />
              </figure>
              <div className="practice-row__copy">
                <h3>{item.title}</h3>
                <p className="practice-row__zh">{item.titleZh}</p>
                <p>{item.description}</p>
              </div>
              <ArrowDownRight
                className="practice-row__arrow"
                size={20}
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
      </section>

      <section
        className="selected-work page-section"
        id="selected-work"
        aria-labelledby="work-title"
        data-nav-section="work"
        data-header-theme="light"
      >
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

      <section
        className="about page-section page-shell"
        id="about"
        aria-labelledby="about-title"
        data-nav-section="studio"
        data-header-theme="light"
      >
        <div className="about-grid">
          <div>
            <p className="section-label" data-motion-reveal>04 / ABOUT</p>
            <h2 id="about-title" data-motion-mask>A SMALL LAB FOR REAL DIGITAL EXPERIMENTS.</h2>
          </div>
          <div className="about-copy">
            {aboutPoints.map((point) => (
              <p key={point} data-motion-reveal>{point}</p>
            ))}
            <div data-motion-reveal>
              <SignalButton href="/studio" variant="line">Read the studio notes</SignalButton>
            </div>
          </div>
        </div>
        <div className="about-process" aria-label="MORPH//LAB working materials">
          <figure className="about-process__primary" data-project-mask>
            <img
              src={withBasePath("/images/morph-studio-workbench-v1.webp")}
              alt="MORPH//LAB 工作台上的纸张样本、实体原型、ESP32 与灯环"
              width={1600}
              height={1000}
              loading="lazy"
            />
            <figcaption>
              <span>01 / MATERIAL BENCH</span>
              <span>Paper, device shell, ESP32</span>
            </figcaption>
          </figure>
          <figure className="about-process__detail" data-project-mask>
            <img
              src={withBasePath("/images/morph-hero-materials-v1.webp")}
              alt="从设计材料到硬件原型的俯拍工作过程"
              width={1600}
              height={1000}
              loading="lazy"
            />
            <figcaption>
              <span>02 / BUILD DETAIL</span>
              <span>Measure, test, revise</span>
            </figcaption>
          </figure>
        </div>
        <dl className="lab-metrics" aria-label="MORPH//LAB working focus">
          <div data-motion-reveal><dt>65</dt><dd>PERSONAS STRUCTURED</dd></div>
          <div data-motion-reveal><dt>08</dt><dd>PERSONA FAMILIES</dd></div>
          <div data-motion-reveal><dt>04</dt><dd>DIGITAL WEB DIRECTIONS</dd></div>
          <div data-motion-reveal><dt>ESP32</dt><dd>PHYSICAL INTERACTION LOOP</dd></div>
        </dl>
      </section>

      <section
        className="final-cta final-cta--ink"
        aria-labelledby="cta-title"
        data-nav-section="contact"
        data-header-theme="dark"
      >
        <div className="page-shell final-cta__inner">
          <div className="final-cta__convergence" data-cta-convergence aria-hidden="true">
            {["observe", "structure", "prototype", "release"].map((stage) => (
              <span className={`final-cta__route final-cta__route--${stage}`} key={stage}>
                <span className="final-cta__route-line" data-cta-path />
              </span>
            ))}
            <span className="final-cta__mark" data-cta-mark>MORPH//LAB</span>
          </div>
          <p className="section-label" data-motion-reveal>05 / NEXT RELEASE</p>
          <h2 id="cta-title" data-motion-mask>LET&apos;S MAKE THE NEXT ONE REAL.</h2>
          <p data-motion-reveal>
            带着一个问题、一组材料，或一个还没完全成形的想法开始。目标是把它做成可运行的作品。
          </p>
          <SignalButton
            href="/contact"
            className="final-cta__button"
            hoverLabel="OPEN THE BRIEF"
          >
            START A CONVERSATION
          </SignalButton>
        </div>
      </section>
    </main>
  );
}
