export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://morph-lab.test"
).replace(/\/$/, "");

export function withBasePath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}
