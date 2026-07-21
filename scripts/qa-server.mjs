import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import worker from "../dist/server/index.js";

const host = "127.0.0.1";
const port = Number(process.env.QA_PORT ?? 5191);
const clientRoot = resolve("dist/client");
const publicRoot = resolve("public");

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function resolveInside(root, pathname) {
  const candidate = resolve(root, pathname.replace(/^\/+/, ""));
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

async function staticResponse(pathname) {
  for (const root of [clientRoot, publicRoot]) {
    const candidate = resolveInside(root, pathname);
    if (!candidate) continue;

    try {
      if (!(await stat(candidate)).isFile()) continue;
      const body = await readFile(candidate);
      return new Response(body, {
        headers: {
          "content-type": contentTypes[extname(candidate).toLowerCase()] ?? "application/octet-stream",
        },
      });
    } catch {
      // Try the next static root before handing the request to the app worker.
    }
  }

  return new Response("Not found", { status: 404 });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    let appResponse = await staticResponse(url.pathname);

    if (
      appResponse.status === 404 &&
      (!url.pathname.includes(".") || url.pathname.endsWith(".rsc"))
    ) {
      appResponse = await worker.fetch(
        new Request(url, {
          method: request.method,
          headers: request.headers,
        }),
        { ASSETS: { fetch: (assetRequest) => staticResponse(new URL(assetRequest.url).pathname) } },
        { waitUntil() {}, passThroughOnException() {} },
      );
    }

    response.writeHead(appResponse.status, Object.fromEntries(appResponse.headers));
    response.end(Buffer.from(await appResponse.arrayBuffer()));
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.stack : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`QA server: http://${host}:${port}`);
});
