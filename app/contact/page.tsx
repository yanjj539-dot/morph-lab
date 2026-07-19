import type { Metadata } from "next";
import { ContactForm } from "../components/ContactForm";

export const metadata: Metadata = {
  title: "Contact — MORPH//LAB",
  description:
    "Start a conversation with MORPH//LAB about interactive web systems, AI visual direction or experimental prototypes.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main id="main-content" className="inner-page contact-page">
      <header className="page-hero page-shell contact-hero">
        <div className="section-kicker">
          <span>INDEX / 03</span>
          <span>START A CONVERSATION</span>
        </div>
        <h1 data-motion-mask>BRING A QUESTION.<br />WE&apos;LL BUILD THE FRAME.</h1>
        <div className="page-hero__support" data-motion-reveal>
          <p>请先告诉我们真正想改变什么，而不只是想制作什么。</p>
          <p>
            适合讨论：创意网站、AI 视觉方向、交互系统、Agent 工作流与可以运行的实验型原型。
          </p>
        </div>
      </header>

      <section className="contact-grid page-section page-shell" aria-labelledby="contact-form-title">
        <div className="contact-details">
          <p className="section-label">CONTACT CHANNEL</p>
          <h2 id="contact-form-title">DESCRIBE THE<br />SYSTEM YOU NEED.</h2>
          <dl>
            <div><dt>Email</dt><dd><a href="mailto:hello@morphlab.design">hello@morphlab.design</a></dd></div>
            <div><dt>Language</dt><dd>中文 / English</dd></div>
            <div><dt>Good fit</dt><dd>AI design systems, editorial websites, interactive prototypes</dd></div>
            <div><dt>First step</dt><dd>A clear question, existing materials and what the first version should prove</dd></div>
          </dl>
        </div>
        <ContactForm />
      </section>

      <section className="contact-notes page-shell" aria-label="Useful project context">
        <p>USEFUL CONTEXT</p>
        <ul>
          <li>What needs to change?</li>
          <li>Who will use it?</li>
          <li>What material already exists?</li>
          <li>What does a successful first version prove?</li>
        </ul>
      </section>
    </main>
  );
}
