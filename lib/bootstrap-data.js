const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = process.cwd();
const STATIC_CACHE = Symbol.for("running-shoes.bootstrap.static");
const SUPABASE_CACHE = Symbol.for("running-shoes.bootstrap.supabase");
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadSupabaseBootstrap() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment is not configured");
  }

  const cached = globalThis[SUPABASE_CACHE];
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const [shoeRows, periodRows, entryRows, priceRows] = await Promise.all([
    fetchSupabase(supabaseUrl, supabaseKey, "/rest/v1/shoes?select=data&order=sort_order.asc"),
    fetchSupabase(supabaseUrl, supabaseKey, "/rest/v1/lineup_periods?select=data&order=sort_order.asc"),
    fetchSupabase(supabaseUrl, supabaseKey, "/rest/v1/lineup_items?select=data&order=sort_order.asc"),
    fetchSupabase(supabaseUrl, supabaseKey, "/rest/v1/price_query_config?select=data&id=eq.default&limit=1"),
  ]);

  const shoes = shoeRows.map((row) => row.data).filter(Boolean);
  const periods = periodRows.map((row) => row.data).filter(Boolean);
  const entries = entryRows.map((row) => row.data).filter(Boolean);

  if (!shoes.length || !periods.length || !entries.length) {
    throw new Error("Supabase bootstrap tables are empty");
  }

  const data = {
    source: "supabase",
    version: periods.find((period) => period.active)?.id || "supabase",
    shoes,
    lineupHistory: {
      version: "supabase-bootstrap",
      source: "Supabase running shoe lineup tables",
      periods,
      entries,
    },
    priceQueryConfig: priceRows[0]?.data || {},
  };

  globalThis[SUPABASE_CACHE] = {
    loadedAt: Date.now(),
    data,
  };

  return data;
}

async function fetchSupabase(supabaseUrl, supabaseKey, restPath) {
  const url = `${supabaseUrl.replace(/\/$/, "")}${restPath}`;
  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 180)}`);
  }

  return response.json();
}

function loadStaticBootstrap() {
  const cached = globalThis[STATIC_CACHE];
  if (cached) return cached;

  const context = { window: {} };
  vm.createContext(context);
  runScript(context, "data/shoes.js");
  runScript(context, "data/lineup-history.js");
  runScript(context, "data/price-queries.js");

  const data = {
    source: "static-fallback",
    version: context.window.RUNNING_LINEUP_VERSION || context.window.RUNNING_LINEUP_HISTORY?.version || "static",
    shoes: context.window.RUNNING_SHOES || [],
    lineupHistory: context.window.RUNNING_LINEUP_HISTORY || {
      periods: context.window.RUNNING_LINEUP_PERIODS || [],
      entries: [],
    },
    priceQueryConfig: context.window.RUNNING_PRICE_QUERY_CONFIG || {},
  };

  globalThis[STATIC_CACHE] = data;
  return data;
}

function bootstrapCounts(data) {
  return {
    shoes: data.shoes?.length || 0,
    periods: data.lineupHistory?.periods?.length || 0,
    entries: data.lineupHistory?.entries?.length || 0,
    hasPriceQueryConfig: Boolean(data.priceQueryConfig && Object.keys(data.priceQueryConfig).length),
  };
}

function runScript(context, relativePath) {
  const filename = path.join(ROOT, relativePath);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
}

function sanitizeHeader(value) {
  return String(value || "unknown")
    .replace(/[^\x20-\x7e]/g, " ")
    .slice(0, 180);
}

module.exports = {
  bootstrapCounts,
  loadStaticBootstrap,
  loadSupabaseBootstrap,
  sanitizeHeader,
};
