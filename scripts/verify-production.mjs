import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const routes = require("../lib/shoe-routes.js");
const { loadStaticBootstrap } = require("../lib/bootstrap-data.js");

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const [key, ...rest] = arg.split("=");
    return key.startsWith("--") ? [[key.slice(2), rest.join("=") || "1"]] : [];
  })
);

const productionUrl = normalizeUrl(args.get("url") || process.env.PRODUCTION_URL || "https://runfit-lineup.vercel.app");
// Static data is the intentional production mode; DB verification is opt-in.
const allowFallback = !args.has("require-supabase");

const healthPath = allowFallback ? "/api/health" : "/api/health?strict=1";
const health = await fetchJson(`${productionUrl}${healthPath}`);
const html = await fetchText(productionUrl);
const sitemap = await fetchText(`${productionUrl}/sitemap.xml`);
const robots = await fetchText(`${productionUrl}/robots.txt`);
const shoes = loadStaticBootstrap().shoes;
const failedPages = [];
for (let offset = 0; offset < shoes.length; offset += 12) {
  await Promise.all(shoes.slice(offset, offset + 12).map(async (shoe) => {
    const route = routes.pathFor(shoe);
    try {
      const page = await fetchText(productionUrl + route);
      const schemaText = page.body.match(/<script[^>]*data-product-schema[^>]*>([\s\S]*?)<\/script>/)?.[1];
      const schema = schemaText ? JSON.parse(schemaText) : null;
      if (page.status !== 200 || schema?.url !== routes.ORIGIN + route || schema?.name !== (shoe.displayName || shoe.model) || !page.body.includes('property="og:image"') || !page.body.includes('<body data-route="detail">')) failedPages.push(route);
    } catch { failedPages.push(route); }
  }));
}

const result = {
  url: productionUrl,
  healthStatus: health.status,
  source: health.data?.source || null,
  version: health.data?.version || null,
  counts: health.data?.counts || null,
  hasRuntimeLoader: html.body.includes("runtime-data.js"),
  hasAppScript: html.body.includes("app.js"),
  productPages: shoes.length,
  failedPages,
  sitemapOk: sitemap.status === 200 && [...sitemap.body.matchAll(/<loc>/g)].length === shoes.length + 1 && shoes.every((shoe) => sitemap.body.includes(routes.ORIGIN + routes.pathFor(shoe))),
  robotsOk: robots.status === 200 && robots.body.includes(`Sitemap: ${routes.ORIGIN}/sitemap.xml`),
};

const expectedCounts = result.counts?.shoes >= 121 && result.counts?.periods >= 9 && result.counts?.entries >= 716;
const sourceOk = allowFallback ? ["supabase", "static-fallback"].includes(result.source) : result.source === "supabase";
const ok = health.status === 200 && health.data?.ok === true && sourceOk && expectedCounts && result.hasRuntimeLoader && result.hasAppScript && !failedPages.length && result.sitemapOk && result.robotsOk;

console.log(JSON.stringify({ ok, ...result }, null, 2));

if (!ok) {
  process.exit(1);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return { status: response.status, body: await response.text() };
}

function normalizeUrl(value) {
  return String(value || "").replace(/\/$/, "");
}
