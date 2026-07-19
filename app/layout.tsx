import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { MotionController } from "./components/MotionController";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141716",
  colorScheme: "dark",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "morph-lab.local";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "MORPH//LAB — AI Design and Interactive Systems",
    description:
      "MORPH//LAB / 形态智能实验室，将人工智能、视觉系统、交互设计与创意前端结合成可真实运行的数字体验。",
    applicationName: "MORPH//LAB",
    authors: [{ name: "MORPH//LAB" }],
    creator: "MORPH//LAB",
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
      apple: "/apple-touch-icon.png",
    },
    alternates: { canonical: origin },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: origin,
      siteName: "MORPH//LAB",
      title: "MORPH//LAB — AI Design and Interactive Systems",
      description:
        "Designing intelligence into form through visual systems, interaction and creative technology.",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "MORPH//LAB modular kinetic design system",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "MORPH//LAB — AI Design and Interactive Systems",
      description: "Designing intelligence into form.",
      images: [`${origin}/og.png`],
    },
  };
}

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "#organization",
      name: "MORPH//LAB",
      alternateName: "形态智能实验室",
      description:
        "An experimental studio for AI visual direction, interactive web design and creative frontend systems.",
      email: "hello@morphlab.design",
    },
    {
      "@type": "WebSite",
      "@id": "#website",
      name: "MORPH//LAB",
      inLanguage: ["en", "zh-CN"],
      publisher: { "@id": "#organization" },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <SiteHeader />
        <MotionController />
        {children}
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
