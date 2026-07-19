import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { MotionController } from "./components/MotionController";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5ef",
  colorScheme: "light",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "morph-lab.local";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const isLocalHost =
    host.includes("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]") ||
    host.startsWith("::1");
  const protocol = forwardedProtocol ?? (isLocalHost ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "MORPH//LAB — AI Design, Interactive Systems and Digital Experiments",
    description:
      "MORPH//LAB 把模型、界面与视觉实验，做成真正可以运行的作品：AI design workflows, interactive systems and digital portfolio experiments.",
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
      title: "MORPH//LAB — AI Design, Interactive Systems and Digital Experiments",
      description:
        "A calm blue-and-paper studio site for real AI design, interactive systems and digital experiments.",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "MORPH//LAB blue editorial homepage for design systems and digital experiments",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "MORPH//LAB — AI Design, Interactive Systems and Digital Experiments",
      description: "Design, systems, and digital experiments made into real running work.",
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
        "An experimental studio for AI design workflows, interactive systems and digital portfolio experiments.",
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
