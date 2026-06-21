import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const CHUNK_SIZE = 200;
const dryRun = process.argv.includes("--dry-run");
const skipDelete = process.argv.includes("--skip-delete");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tablePrefix = normalizeTablePrefix(process.env.SUPABASE_TABLE_PREFIX);

if (!supabaseUrl || !serviceRoleKey) {
  fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const data = loadSeedData();
const rows = buildRows(data);

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        supabaseUrl: redactedUrl(supabaseUrl),
        periods: rows.periods.length,
        shoes: rows.shoes.length,
        lineupItems: rows.lineupItems.length,
        priceQueryConfig: rows.priceQueryConfig.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (!skipDelete) {
  await deleteRows(tableName("lineup_items"), "id=not.is.null");
  await deleteRows(tableName("shoes"), "id=not.is.null");
  await deleteRows(tableName("lineup_periods"), "id=not.is.null");
  await deleteRows(tableName("price_query_config"), "id=eq.default");
}

await upsertRows(tableName("lineup_periods"), "id", rows.periods);
await upsertRows(tableName("shoes"), "id", rows.shoes);
await upsertRows(tableName("lineup_items"), "period_id,brand,category", rows.lineupItems);
await upsertRows(tableName("price_query_config"), "id", rows.priceQueryConfig);

console.log(
  JSON.stringify(
    {
      ok: true,
      periods: rows.periods.length,
      shoes: rows.shoes.length,
      lineupItems: rows.lineupItems.length,
      priceQueryConfig: rows.priceQueryConfig.length,
    },
    null,
    2
  )
);

function loadSeedData() {
  const context = { window: {} };
  vm.createContext(context);
  runScript(context, "data/shoes.js");
  runScript(context, "data/lineup-history.js");
  runScript(context, "data/price-queries.js");

  const shoes = context.window.RUNNING_SHOES || [];
  const history = context.window.RUNNING_LINEUP_HISTORY || {};
  const periods = history.periods || context.window.RUNNING_LINEUP_PERIODS || [];
  const entries = history.entries || [];
  const priceQueryConfig = context.window.RUNNING_PRICE_QUERY_CONFIG || {};

  if (!shoes.length) fail("No shoes loaded from data/shoes.js");
  if (!periods.length) fail("No periods loaded from data/lineup-history.js");
  if (!entries.length) fail("No lineup entries loaded from data/lineup-history.js");

  return { shoes, periods, entries, priceQueryConfig };
}

function buildRows({ shoes, periods, entries, priceQueryConfig }) {
  return {
    periods: periods.map((period, index) => ({
      id: period.id,
      label: period.label,
      sort_order: index,
      active: Boolean(period.active),
      source_post_url: period.sourcePostUrl || null,
      table_image_url: period.tableImageUrl || null,
      data: period,
    })),
    shoes: shoes.map((shoe, index) => ({
      id: shoe.id,
      brand: shoe.brand,
      model: shoe.model,
      display_name: shoe.displayName || null,
      category_group: shoe.categoryGroup,
      category: shoe.category,
      sort_order: index,
      drop_mm: Number.isFinite(Number(shoe.dropMm)) ? Number(shoe.dropMm) : null,
      tags: shoe.tags || [],
      image_url: shoe.imageUrl || null,
      image_source_url: shoe.imageSourceUrl || null,
      official_product_url: shoe.officialProductUrl || null,
      data: shoe,
    })),
    lineupItems: entries.map((entry, index) => {
      const [periodId, brand, category, models] = entry;
      return {
        period_id: periodId,
        brand,
        category,
        sort_order: index,
        models: models || [],
        data: entry,
      };
    }),
    priceQueryConfig: [
      {
        id: "default",
        data: priceQueryConfig,
      },
    ],
  };
}

async function deleteRows(table, query) {
  await request(`/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

async function upsertRows(table, onConflict, rows) {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    await request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
  }
}

async function request(restPath, options) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}${restPath}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    fail(`${options.method || "GET"} ${restPath} failed: ${response.status} ${body.slice(0, 400)}`);
  }
}

function runScript(context, relativePath) {
  const filename = path.join(ROOT, relativePath);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
}

function redactedUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}/...`;
  } catch {
    return "configured";
  }
}

function normalizeTablePrefix(value) {
  const prefix = value === undefined ? "runfit_" : String(value);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(`${prefix}table`)) {
    fail("Invalid SUPABASE_TABLE_PREFIX.");
  }
  return prefix;
}

function tableName(name) {
  return `${tablePrefix}${name}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
