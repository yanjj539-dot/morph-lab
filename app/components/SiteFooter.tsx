"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getTokyoTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function SiteFooter() {
  const [time, setTime] = useState("--:--");

  useEffect(() => {
    const update = () => setTime(getTokyoTime());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Link href="/">MORPH//LAB</Link>
        <p>AI / DESIGN / INTERACTION / SYSTEMS</p>
      </div>
      <div className="footer-links" aria-label="Footer">
        <Link href="/work">Work</Link>
        <Link href="/studio">Studio</Link>
        <Link href="/contact">Contact</Link>
        <a href="mailto:hello@morphlab.design">Email</a>
      </div>
      <div className="footer-status">
        <p><span className="status-dot" aria-hidden="true" /> SYSTEM STATUS: ACTIVE</p>
        <p>LOCAL TIME: {time} JST</p>
      </div>
      <div className="footer-legal">
        <span>© {new Date().getFullYear()} MORPH//LAB</span>
        <Link href="/studio#privacy">Privacy</Link>
      </div>
    </footer>
  );
}

