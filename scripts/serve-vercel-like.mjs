import { createRequire } from "node:module";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";

const require = createRequire(import.meta.url);
const bootstrap = require("../api/bootstrap.js");
const health = require("../api/health.js");

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4193);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/api/bootstrap") {
      await bootstrap(req, res);
      return;
    }
    if (url.pathname === "/api/health") {
      await health(req, res);
      return;
    }
    await serveStatic(url.pathname, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(error instanceof Error ? error.stack : String(error));
  }
}).listen(port, () => {
  console.log(`Vercel-like local server: http://127.0.0.1:${port}`);
});

async function serveStatic(pathname, res) {
  const decoded = decodeURIComponent(pathname);
  const candidate = normalize(decoded === "/" ? "/index.html" : decoded);
  const filename = resolve(join(root, candidate));
  if (!filename.startsWith(root)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  let filePath = filename;
  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
      fileStat = await stat(filePath);
    }
  } catch {
    filePath = join(root, "index.html");
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", contentTypes.get(extname(filePath)) || "application/octet-stream");
  res.end(await readFile(filePath));
}
