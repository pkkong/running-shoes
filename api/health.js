const {
  bootstrapCounts,
  loadStaticBootstrap,
  loadSupabaseBootstrap,
  sanitizeHeader,
} = require("../lib/bootstrap-data");

module.exports = async function health(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  try {
    const data = await loadSupabaseBootstrap();
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        source: data.source,
        version: data.version,
        counts: bootstrapCounts(data),
      })
    );
  } catch (error) {
    const fallback = loadStaticBootstrap();
    const strict = new URL(req.url || "/api/health", "http://localhost").searchParams.get("strict") === "1";
    res.statusCode = strict ? 503 : 200;
    res.end(
      JSON.stringify({
        ok: !strict,
        source: fallback.source,
        version: fallback.version,
        fallbackReason: sanitizeHeader(error instanceof Error ? error.message : String(error)),
        counts: bootstrapCounts(fallback),
      })
    );
  }
};
