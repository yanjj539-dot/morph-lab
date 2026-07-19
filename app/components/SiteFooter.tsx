"use client";

import { withBasePath } from "../lib/paths";

const FOOTER_LINKS = [
  { href: "/work", label: "Work" },
  { href: "/#process", label: "Process" },
  { href: "/studio", label: "Studio" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <a href={withBasePath("/")}>MORPH//LAB</a>
        <p>Design, systems, and digital experiments.</p>
      </div>
      <div className="footer-links" aria-label="Footer">
        {FOOTER_LINKS.map((item) => (
          <a key={item.href} href={withBasePath(item.href)}>
            {item.label}
          </a>
        ))}
        <a href="mailto:hello@morphlab.design">Email</a>
      </div>
      <div className="footer-legal">
        <span>© {new Date().getFullYear()} MORPH//LAB</span>
        <span>Built for real interactive work.</span>
      </div>
    </footer>
  );
}
