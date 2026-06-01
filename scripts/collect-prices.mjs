import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const DEFAULT_OUT = "data/prices/latest.js";
const API_URL = "https://openapi.naver.com/v1/search/shop.json";
const DEFAULT_DISPLAY = 30;
const DEFAULT_DELAY_MS = 140;

const args = parseArgs(process.argv.slice(2));
const outFile = args.out || DEFAULT_OUT;
const limit = args.limit ? Number(args.limit) : 0;
const dryRun = Boolean(args["dry-run"]);

const clientId = process.env.NAVER_CLIENT_ID;
const clientSecret = process.env.NAVER_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("NAVER_CLIENT_ID and NAVER_CLIENT_SECRET are required.");
  process.exit(1);
}

const { shoes, queryConfig } = loadData();
const selectedShoes = Number.isFinite(limit) && limit > 0 ? shoes.slice(0, limit) : shoes;
const startedAt = new Date().toISOString();
const snapshot = {
  generatedAt: startedAt,
  source: "naver-shopping-search-api",
  currency: "KRW",
  display: DEFAULT_DISPLAY,
  items: {},
};

for (const [index, shoe] of selectedShoes.entries()) {
  const querySpec = buildQuerySpec(shoe, queryConfig);
  process.stdout.write(`[${index + 1}/${selectedShoes.length}] ${shoe.id} · ${querySpec.query}\n`);

  try {
    const response = await requestShopping(querySpec.query, DEFAULT_DISPLAY);
    const offers = rankOffers(shoe, response.items || [], querySpec).slice(0, 5);
    snapshot.items[shoe.id] = buildPriceItem(querySpec, offers);
  } catch (error) {
    snapshot.items[shoe.id] = {
      status: "error",
      query: querySpec.query,
      fetchedAt: new Date().toISOString(),
      lowestPrice: null,
      lowestOffer: null,
      offers: [],
      confidence: "low",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (index < selectedShoes.length - 1) {
    await sleep(DEFAULT_DELAY_MS);
  }
}

if (dryRun) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  writeSnapshot(outFile, snapshot);
  console.log(`Wrote ${outFile}`);
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function loadData() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data/shoes.js"), "utf8"), context, {
    filename: "data/shoes.js",
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "data/price-queries.js"), "utf8"), context, {
    filename: "data/price-queries.js",
  });

  return {
    shoes: context.window.RUNNING_SHOES || [],
    queryConfig: context.window.RUNNING_PRICE_QUERY_CONFIG || {},
  };
}

function buildQuerySpec(shoe, config) {
  const override = config.overrides?.[shoe.id] || {};
  const brandQuery = override.brand || config.brandQueryNames?.[shoe.brand] || shoe.brand;
  const suffix = override.suffix ?? config.defaultSuffix ?? "러닝화";
  const modelQuery = override.model || shoe.model;
  const query = override.query || [brandQuery, modelQuery, suffix].filter(Boolean).join(" ");
  const brandAliases = [shoe.brand, brandQuery, ...(config.aliases?.[shoe.brand] || []), ...(override.brandAliases || [])];
  const modelAliases = unique([shoe.model, shoe.displayName, ...(override.modelAliases || [])].filter(Boolean));
  const blockTerms = unique([...(config.blockTerms || []), ...(override.blockTerms || [])]);
  const minimumPrice = Number(override.minimumPrice ?? config.minimumPrice ?? 0);

  return {
    query,
    brandAliases,
    modelAliases,
    requiredTerms: override.requiredTerms || [],
    blockTerms,
    minimumPrice: Number.isFinite(minimumPrice) ? minimumPrice : 0,
  };
}

async function requestShopping(query, display) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    query,
    display: String(display),
    start: "1",
    sort: "asc",
    exclude: "used:rental:cbshop",
  }).toString();

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Naver API ${response.status}: ${body.slice(0, 240)}`);
  }

  return response.json();
}

function rankOffers(shoe, items, querySpec) {
  return items
    .map((item) => scoreOffer(shoe, item, querySpec))
    .filter(Boolean)
    .sort((a, b) => a.price - b.price || b.score - a.score)
    .map(({ item, price, confidence }) => ({
      title: cleanText(item.title),
      link: item.link || "",
      image: item.image || "",
      price,
      mallName: cleanText(item.mallName || ""),
      productId: String(item.productId || ""),
      productType: Number(item.productType || 0),
      brand: cleanText(item.brand || ""),
      maker: cleanText(item.maker || ""),
      category: [item.category1, item.category2, item.category3, item.category4].filter(Boolean).map(cleanText),
      confidence,
    }));
}

function scoreOffer(shoe, item, querySpec) {
  const price = Number(item.lprice);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (querySpec.minimumPrice && price < querySpec.minimumPrice) return null;

  const title = cleanText(item.title);
  const titleNorm = compact(title);
  const catalogText = compact(
    [title, item.brand, item.maker, item.category1, item.category2, item.category3, item.category4].filter(Boolean).join(" ")
  );

  if (querySpec.blockTerms.some((term) => catalogText.includes(compact(term)))) {
    return null;
  }

  const brandMatched = querySpec.brandAliases.some((brand) => catalogText.includes(compact(brand)));
  const aliasHits = querySpec.modelAliases
    .map((alias) => matchAliasScore(titleNorm, alias))
    .filter((match) => match.usable)
    .sort((a, b) => b.hitScore - a.hitScore);
  const bestAlias = aliasHits[0] || { hitScore: 0, hits: 0, total: 0 };
  const exactAliasMatched = aliasHits.some((match) => match.exact);
  const requiredMatched = querySpec.requiredTerms.every((term) => catalogText.includes(compact(term)));
  const hasRequiredTerms = querySpec.requiredTerms.length > 0;
  const shoeSignal = /러닝|운동화|신발|슈즈|running|runner|shoe|shoes|road/.test(catalogText);

  if (hasRequiredTerms && !requiredMatched) return null;
  if (!exactAliasMatched) return null;
  if (bestAlias.hits === 0) return null;
  if (!brandMatched && bestAlias.hitScore < 4) return null;

  const score = bestAlias.hitScore + (brandMatched ? 3 : 0) + (shoeSignal ? 1 : 0);
  const confidence = score >= 7 && brandMatched ? "high" : score >= 4 ? "medium" : "low";

  return {
    item,
    price,
    score,
    confidence,
  };
}

function matchAliasScore(textNorm, alias) {
  const aliasNorm = compact(alias);
  const terms = tokenize(alias);
  const usable = aliasNorm.length >= 5;
  if (!terms.length || !usable) return { hitScore: 0, hits: 0, total: 0, exact: false, usable: false };

  let hits = 0;
  let hitScore = 0;
  terms.forEach((term) => {
    const norm = compact(term);
    if (!norm || !textNorm.includes(norm)) return;
    hits += 1;
    hitScore += /\d/.test(norm) || norm.length >= 4 ? 2 : 1;
  });

  return {
    hitScore,
    hits,
    total: terms.length,
    exact: textNorm.includes(aliasNorm),
    usable,
  };
}

function tokenize(value) {
  return unique(
    String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term && !isStopTerm(term))
  );
}

function isStopTerm(term) {
  return [
    "running",
    "road",
    "runner",
    "shoe",
    "shoes",
    "mens",
    "women",
    "womens",
    "men",
    "러닝화",
    "운동화",
    "남성",
    "여성",
  ].includes(term);
}

function buildPriceItem(querySpec, offers) {
  const fetchedAt = new Date().toISOString();
  if (!offers.length) {
    return {
      status: "no_match",
      query: querySpec.query,
      fetchedAt,
      lowestPrice: null,
      lowestOffer: null,
      offers: [],
      confidence: "low",
      message: "조건에 맞는 가격 결과를 찾지 못했습니다.",
    };
  }

  return {
    status: "found",
    query: querySpec.query,
    fetchedAt,
    lowestPrice: offers[0].price,
    lowestOffer: offers[0],
    offers,
    confidence: offers[0].confidence,
    message: "",
  };
}

function writeSnapshot(file, snapshotData) {
  const absolute = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const body = JSON.stringify(snapshotData, null, 2);
  const content = `(function () {\n  window.RUNNING_PRICE_SNAPSHOT = ${body};\n})();\n`;
  fs.writeFileSync(absolute, content);
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value) {
  return cleanText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
