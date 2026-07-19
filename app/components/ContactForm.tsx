"use client";

import { useState, type FormEvent } from "react";

export function ContactForm() {
  const [status, setStatus] = useState("填写后将打开你的邮件应用，不会在网页中储存信息。");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const project = String(data.get("project") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    const subject = encodeURIComponent(`[MORPH//LAB] ${project || "New system inquiry"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nProject: ${project}\n\n${message}`,
    );
    setStatus("正在打开邮件应用…");
    window.location.href = `mailto:hello@morphlab.design?subject=${subject}&body=${body}`;
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="name">Name / 姓名</label>
        <input id="name" name="name" autoComplete="name" required />
      </div>
      <div className="form-row">
        <label htmlFor="email">Email / 邮箱</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="form-row">
        <label htmlFor="project">Project / 项目类型</label>
        <select id="project" name="project" defaultValue="Interactive web system">
          <option>Interactive web system</option>
          <option>AI visual direction</option>
          <option>Agent workflow design</option>
          <option>Experimental prototype</option>
          <option>Other</option>
        </select>
      </div>
      <div className="form-row form-row--message">
        <label htmlFor="message">Brief / 说明</label>
        <textarea id="message" name="message" rows={7} required />
      </div>
      <button className="form-submit" type="submit">
        <span>Compose email</span><span aria-hidden="true">↗</span>
      </button>
      <p className="form-status" aria-live="polite">{status}</p>
    </form>
  );
}

