const {
  loadStaticBootstrap,
  loadSupabaseBootstrap,
  sanitizeHeader,
} = require("../lib/bootstrap-data");

module.exports = async function bootstrap(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");

  try {
    const data = await loadSupabaseBootstrap();
    res.setHeader("X-Running-Bootstrap-Source", data.source);
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (error) {
    const fallback = loadStaticBootstrap();
    res.setHeader("X-Running-Bootstrap-Source", fallback.source);
    res.setHeader("X-Running-Bootstrap-Fallback-Reason", sanitizeHeader(error instanceof Error ? error.message : String(error)));
    res.statusCode = 200;
    res.end(JSON.stringify(fallback));
  }
};
