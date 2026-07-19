import type { MetadataRoute } from "next";
import { siteUrl } from "./lib/paths";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/work", "/studio", "/contact"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date("2026-07-19"),
    changeFrequency: path === "" ? "monthly" : "yearly",
    priority: path === "" ? 1 : 0.8,
  }));
}
