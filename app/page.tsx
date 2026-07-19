import { CapabilityAccordion } from "./components/CapabilityAccordion";
import { FaqAccordion } from "./components/FaqAccordion";
import LiveGenerativeSystem from "./components/LiveGenerativeSystem";
import MorphCore from "./components/MorphCore";
import { ProjectShowcase } from "./components/ProjectShowcase";
import { SignalButton } from "./components/SignalButton";
import { processSteps } from "./data/site";

export default function Home() {
  return (
    <main id="main-content">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-visual" aria-hidden="true">
          <MorphCore />
        </div>
        <div className="hero-grid page-shell">
          <div className="hero-status motion-reveal">
            <p><span className="status-dot" aria-hidden="true" /> MORPH SYSTEM / ONLINE</p>
            <p>GENERATIVE DESIGN LAB</p>
            <p>TOKYO — DIGITAL SPACE</p>
          </div>
          <div className="hero-copy">
            <h1 id="hero-title" data-motion-mask>
              <span>DESIGNING</span>
              <span>INTELLIGENCE</span>
              <span>INTO FORM</span>
            </h1>
            <div className="hero-support" data-motion-reveal>
              <p className="hero-title-zh">让智能成为一种<br />可以被感知的形态</p>
              <p className="hero-description">
                我们将人工智能、视觉系统、交互设计与前端技术结合，构建小而精、可以真实运行的数字体验。
              </p>
              <div className="hero-actions">
                <SignalButton href="#capabilities">Explore the Systems</SignalButton>
                <SignalButton href="/work" variant="line">View Selected Work</SignalButton>
              </div>
            </div>
          </div>
          <a className="scroll-cue" href="#manifesto">
            <span>SCROLL TO ENTER THE SYSTEM</span>
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <section className="manifesto page-section page-shell" id="manifesto">
        <div className="section-kicker" data-motion-reveal>
          <span>01 / MANIFESTO</span>
          <span>POSITION / 2026</span>
        </div>
        <h2 className="manifesto-title" data-motion-mask>
          AI SHOULD NOT<br />LOOK LIKE AI.
        </h2>
        <div className="manifesto-grid">
          <p className="manifesto-zh" data-motion-reveal>
            好的 AI 设计，<br />不应该首先让人看见 AI。
          </p>
          <div className="manifesto-copy" data-motion-reveal>
            <p>技术服务于体验，动效服务于信息，AI 服务于创意判断。</p>
            <p>
              我们不追求表面的未来感，也不堆砌生成式视觉符号。每个数字体验都应拥有自己的视觉逻辑、节奏与行为边界。
            </p>
          </div>
        </div>
      </section>

      <section className="process page-section" aria-labelledby="process-title">
        <div className="process-grid page-shell">
          <div className="process-intro">
            <p className="section-label">02 / PROCESS</p>
            <h2 id="process-title" data-motion-mask>FROM SIGNAL<br />TO SYSTEM.</h2>
            <p data-motion-reveal>四个阶段，一条连续链路。每一次交付都必须从判断走到运行。</p>
          </div>
          <div className="process-steps">
            {processSteps.map((step) => (
              <article
                className="process-step"
                key={step.index}
                data-scroll-step
                data-scroll-step-group="process"
              >
                <span className="process-number">{step.index}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p className="process-title-zh">{step.titleZh}</p>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="capabilities page-section page-shell" id="capabilities" aria-labelledby="capabilities-title">
        <div className="section-kicker" data-motion-reveal>
          <span>03 / CAPABILITIES</span>
          <span>CONNECTED SYSTEM / 06</span>
        </div>
        <div className="section-heading-grid">
          <h2 id="capabilities-title" data-motion-mask>CAPABILITIES AS A<br />CONNECTED SYSTEM</h2>
          <p data-motion-reveal>不是独立服务卡片，而是一套从视觉判断到部署运行的连接系统。</p>
        </div>
        <CapabilityAccordion />
      </section>

      <section className="selected-work page-section" aria-labelledby="work-title">
        <div className="page-shell">
          <div className="section-kicker" data-motion-reveal>
            <span>04 / SELECTED WORK</span>
            <span>EXPERIMENTS / 2026</span>
          </div>
          <div className="section-heading-grid">
            <h2 id="work-title" data-motion-mask>THREE SYSTEMS.<br />THREE WAYS TO SEE.</h2>
            <p data-motion-reveal>虚构但可被真正制作的实验项目，用来展示不同的内容、交互与技术关系。</p>
          </div>
        </div>
        <ProjectShowcase />
      </section>

      <section className="live-system page-section page-shell" aria-label="Live generative system experiment">
        <div className="section-kicker" data-motion-reveal>
          <span>05 / LIVE SYSTEM</span>
          <span>INPUT / POINTER + CLICK</span>
        </div>
        <LiveGenerativeSystem />
      </section>

      <section className="about page-section page-shell" aria-labelledby="about-title">
        <div className="about-grid">
          <h2 id="about-title" data-motion-mask>A SMALL LAB<br />FOR PRECISE<br />EXPERIMENTS</h2>
          <div className="about-copy" data-motion-reveal>
            <p>
              MORPH//LAB 是一个围绕人工智能、视觉设计、交互体验和创意技术建立的实验型工作室。
            </p>
            <p>
              我们关注的不是如何制造更多内容，而是如何建立更准确、更克制、更有辨识度的数字体验。
            </p>
            <SignalButton href="/studio" variant="line">Read the studio notes</SignalButton>
          </div>
        </div>
        <dl className="lab-metrics">
          <div data-motion-reveal><dt>04</dt><dd>DESIGN SYSTEMS</dd></div>
          <div data-motion-reveal><dt>12</dt><dd>INTERACTIVE PROTOTYPES</dd></div>
          <div data-motion-reveal><dt>27</dt><dd>VISUAL EXPERIMENTS</dd></div>
          <div data-motion-reveal><dt>∞</dt><dd>POSSIBLE FORMS</dd></div>
        </dl>
      </section>

      <section className="faq page-section page-shell" aria-labelledby="faq-title">
        <div className="section-kicker" data-motion-reveal>
          <span>06 / FAQ</span>
          <span>WORKING TOGETHER</span>
        </div>
        <div className="faq-grid">
          <h2 id="faq-title" data-motion-mask>QUESTIONS,<br />BEFORE WE BEGIN.</h2>
          <FaqAccordion />
        </div>
      </section>

      <section className="final-cta" aria-labelledby="cta-title">
        <div className="cta-core" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="page-shell final-cta__inner">
          <p className="section-label">07 / NEXT SYSTEM</p>
          <h2 id="cta-title" data-motion-mask>LET&apos;S BUILD A SYSTEM<br />THAT DOESN&apos;T EXIST YET.</h2>
          <p data-motion-reveal>一起构建一个尚未存在的数字系统。</p>
          <SignalButton href="/contact" className="final-cta__button">START A CONVERSATION</SignalButton>
        </div>
      </section>
    </main>
  );
}
