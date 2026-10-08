import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("data/shoes.js", root), "utf8"), context);
const expectedShoes = context.window.RUNNING_SHOES;
const remoteBase = process.argv.find((arg) => arg.startsWith("--url="))?.slice(6);
let shoes = expectedShoes;
if (remoteBase) {
  const response = await fetch(`${remoteBase.replace(/\/$/, "")}/api/bootstrap`, {
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200, "Production bootstrap must respond successfully");
  const data = await response.json();
  shoes = data.shoes;
}

const stores = {
  Nike: { host: "www.nike.com", prefix: "/kr/", search: "/kr/w", param: "q" },
  Adidas: { host: "www.adidas.co.kr", search: "/search", param: "q" },
  ASICS: { host: "www.asics.co.kr", search: "/goods/search", param: "search_text" },
  "New Balance": { host: "www.nbkorea.com", search: "/product/searchResult.action", param: "schWord" },
  Saucony: { host: "saucony.co.kr", search: "/product/search.html", param: "keyword" },
  Puma: { host: "kr.puma.com", prefix: "/kr/ko/", search: "/kr/ko/search", param: "q" },
  HOKA: { host: "brand.naver.com", prefix: "/hoka/", search: "/hoka/search", param: "q" },
  Brooks: { host: "www.brooksrunning.co.kr", search: "/product/search.html", param: "keyword" },
  Mizuno: { host: "kor.mizuno.com", search: "/product/search.html", param: "keyword" },
  On: { host: "www.on.com", prefix: "/ko-kr/" },
};

assert.ok(Array.isArray(shoes) && shoes.length >= 121, "Shoe data is missing or incomplete");
const expectedById = new Map(expectedShoes.map((shoe) => [shoe.id, shoe]));
const counts = { product: 0, search: 0 };
const brands = new Set();
for (const shoe of shoes) {
  const store = stores[shoe.brand];
  assert.ok(store, `${shoe.id}: Korean store policy is missing`);
  const url = new URL(shoe.officialProductUrl);
  assert.equal(url.protocol, "https:", `${shoe.id}: HTTPS is required`);
  assert.equal(url.hostname, store.host, `${shoe.id}: not the brand's Korean official store`);
  assert.equal(url.username + url.password + url.port, "", `${shoe.id}: unexpected URL credentials/port`);
  if (store.prefix) assert.ok(url.pathname.startsWith(store.prefix), `${shoe.id}: incorrect country/store`);
  assert.ok(["product", "search"].includes(shoe.officialLinkKind), `${shoe.id}: invalid link kind`);
  assert.match(shoe.officialLinkCheckedAt, /^\d{4}-\d{2}-\d{2}$/, `${shoe.id}: missing verification date`);
  if (shoe.officialLinkKind === "search") {
    assert.equal(url.pathname, store.search, `${shoe.id}: incorrect store search endpoint`);
    assert.ok(url.searchParams.get(store.param)?.trim(), `${shoe.id}: missing model search term`);
  }
  const expected = expectedById.get(shoe.id);
  assert.ok(expected, `${shoe.id}: unexpected shoe`);
  assert.equal(shoe.officialProductUrl, expected.officialProductUrl, `${shoe.id}: stale production link`);
  assert.equal(shoe.officialLinkKind, expected.officialLinkKind, `${shoe.id}: stale production link kind`);
  counts[shoe.officialLinkKind] += 1;
  brands.add(shoe.brand);
}
assert.equal(new Set(shoes.map((shoe) => shoe.id)).size, expectedShoes.length, "Missing/duplicate shoes");
assert.equal(brands.size, 10, "All ten brands must have Korean destinations");
console.log(`Korean official links: ${shoes.length} shoes / ${brands.size} brands`);
console.log(`Product pages: ${counts.product}, official store searches: ${counts.search}`);
console.log(`Official link audit passed${remoteBase ? " (production)" : ""}`);
