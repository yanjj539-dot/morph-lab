"use client";

import Link from "next/link";

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
        <Link href="/">MORPH//LAB</Link>
        <p>Design, systems, and digital experiments.</p>
      </div>
      <div className="footer-links" aria-label="Footer">
        {FOOTER_LINKS.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
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
