const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const [key, ...rest] = arg.split("=");
    return key.startsWith("--") ? [[key.slice(2), rest.join("=") || "1"]] : [];
  })
);

const productionUrl = normalizeUrl(args.get("url") || process.env.PRODUCTION_URL || "https://runfit-lineup.vercel.app");
const allowFallback = args.has("allow-fallback");

const healthPath = allowFallback ? "/api/health" : "/api/health?strict=1";
const health = await fetchJson(`${productionUrl}${healthPath}`);
const html = await fetchText(productionUrl);

const result = {
  url: productionUrl,
  healthStatus: health.status,
  source: health.data?.source || null,
  version: health.data?.version || null,
  counts: health.data?.counts || null,
  hasRuntimeLoader: html.body.includes("runtime-data.js"),
  hasAppScript: html.body.includes("app.js"),
};

const expectedCounts = result.counts?.shoes >= 121 && result.counts?.periods >= 9 && result.counts?.entries >= 716;
const sourceOk = allowFallback ? ["supabase", "static-fallback"].includes(result.source) : result.source === "supabase";
const ok = health.status === 200 && health.data?.ok === true && sourceOk && expectedCounts && result.hasRuntimeLoader && result.hasAppScript;

console.log(JSON.stringify({ ok, ...result }, null, 2));

if (!ok) {
  process.exit(1);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

async function fetchText(url) {
  const response = await fetch(url);
  return { status: response.status, body: await response.text() };
}

function normalizeUrl(value) {
  return String(value || "").replace(/\/$/, "");
}
