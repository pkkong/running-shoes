const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadStaticBootstrap } = require("../lib/bootstrap-data.js");
const identity = require("../lib/lineup-models.js");
const content = require("../lib/shoe-content.js");
const routes = require("../lib/shoe-routes.js");
const data = loadStaticBootstrap();
const index = identity.createIndex(data.shoes, data.lineupHistory.periods, data.lineupHistory.entries);
const shoe = (id) => data.shoes.find((item) => item.id === id);

test("Premium resolves exactly even when its category changed", () => {
  assert.equal(index.findCurrent("Nike", "페가수스 프리미엄").id, "nike-페가수스-프리미엄");
  assert.equal(index.findCurrent("Nike", "보메로 프리미엄").id, "nike-보메로-프리미엄");
  assert.equal(index.findCurrent("Nike", "페가수스 41"), null);
  assert.equal(index.findCurrent("Nike", "프리미엄"), null);
  assert.equal(index.findCurrent("On", "클라우드"), null);
});
test("siblings and racing variants are distinct families", () => {
  for (const [brand, a, b] of [["Nike", "페가수스 42", "페가수스 프리미엄"], ["Nike", "페가수스 플러스", "페가수스 프리미엄"], ["Puma", "디비에이트 나이트로 4", "디비에이트 나이트로 엘리트 4"], ["Brooks", "글리세린 23", "글리세린 GTS 23"], ["On", "클라우드 몬스터 3", "클라우드 몬스터 3 하이퍼"]]) {
    assert.notEqual(identity.familyKey(brand, a), identity.familyKey(brand, b));
  }
});
test("explicit generations share families but never exact model IDs", () => {
  for (const [brand, a, b] of [["Nike", "페가수스 41", "페가수스 42"], ["New Balance", "프레시폼 880 V14", "880 V15"], ["HOKA", "마하 X2", "마하 X3"], ["HOKA", "씨엘로 X1 2.0", "씨엘로 X1 3.0"], ["On", "클라우드 몬스터 하이퍼", "클라우드 몬스터 3 하이퍼"]]) {
    assert.equal(identity.familyKey(brand, a), identity.familyKey(brand, b));
    assert.notEqual(identity.modelKey(brand, a), identity.modelKey(brand, b));
  }
});
test("premium first appears in 2025.02 across category changes", () => {
  const history = index.timelineFor(shoe("nike-페가수스-프리미엄"));
  assert.equal(history.count, 7);
  assert.equal(history.streak, 7);
  assert.equal(history.firstPeriod.id, "2025-02");
  assert.equal(history.timeline[0].matched, false);
  assert.equal(history.timeline[1].matched, false);
});
test("model and family timelines are separate; historical cards do not count the future", () => {
  const pegasus = shoe("nike-페가수스-42");
  assert.equal(index.timelineFor(pegasus).count, 2);
  assert.equal(index.timelineFor(pegasus, { scope: "family" }).count, 9);
  assert.equal(index.timelineFor({ brand: "Nike", model: "페가수스 41" }, { throughPeriodId: "2024-08" }).count, 1);
});
test("current models always resolve to their own detail", () => {
  for (const value of data.shoes) assert.equal(index.findCurrent(value.brand, value.model).id, value.id);
});
test("all product URLs are unique ASCII paths and legacy links are supported", () => {
  const paths = data.shoes.map(routes.pathFor);
  assert.equal(new Set(paths).size, data.shoes.length);
  for (const value of data.shoes) {
    assert.match(routes.pathFor(value), /^\/shoes\/[a-z0-9-]+\/$/);
    const current = routes.parse({ pathname: routes.pathFor(value), hash: "", search: "?brand=Nike" }, data.shoes);
    assert.equal(current.shoe.id, value.id);
    const legacy = routes.parse({ pathname: "/", hash: `#/shoe/${encodeURIComponent(value.id)}?period=2025-02` }, data.shoes);
    assert.equal(legacy.shoe.id, value.id);
    assert.equal(legacy.params.get("period"), "2025-02");
  }
});
test("shared renderer contains exact evidence and no duplicate thresholds", () => {
  const value = shoe("nike-페가수스-프리미엄");
  const html = content.detail(value, { history: index.timelineFor(value), review: value.runRepeatReview });
  assert.match(html, /런리핏 83/);
  assert.doesNotMatch(html, /런리핏 81\+|9분기 연속/);
  assert.match(html, /7분기 연속/);
  assert.match(html, /data-history-scope="family"/);
});
test("generated pages contain product-specific crawler/share metadata and HTML content", () => {
  for (const value of data.shoes) {
    const route = routes.pathFor(value);
    const html = fs.readFileSync(path.join(__dirname, "..", route, "index.html"), "utf8");
    assert.ok(html.includes(routes.ORIGIN + route));
    assert.ok(html.includes(content.escape(value.displayName)));
    assert.ok(html.includes("og:image"));
    assert.ok(html.includes("data-product-schema"));
    assert.ok(html.includes('<body data-route="detail">'));
    assert.ok(html.includes('src="/app.js'));
    assert.doesNotMatch(html, /"aggregateRating"|"offers"/);
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)/g)) {
      assert.ok(fs.existsSync(path.join(__dirname, "..", match[1])), `Missing asset: ${match[1]}`);
    }
  }
});

test("unknown models and malformed legacy IDs never select a neighbouring product", () => {
  for (const url of ["https://example.com/shoes/not-a-shoe/", "https://example.com/#/shoe/%ZZ"]) {
    const result = routes.parse(new URL(url), data.shoes);
    assert.equal(result.detailRequested, true);
    assert.equal(result.shoe, undefined);
  }
});

test("threshold evidence is explicitly sourced and missing images show a placeholder", () => {
  const history = { count: 0, streak: 0 };
  assert.equal(content.evidence({ tags: ["runRepeatGreat"], runRepeatEvidence: { threshold: 81, sourceUrl: "https://example.com" } }, history), "");
  const threshold = { tags: ["runRepeatGreat"], runRepeatEvidence: { kind: "chart-threshold", threshold: 81, sourceUrl: "https://example.com", asOf: "2026-08-26" } };
  assert.match(content.evidence(threshold, history), /런리핏 81\+/);
  assert.doesNotMatch(content.evidence({ ...threshold, isHistoryItem: true }, history), /런리핏/);
  assert.match(content.image({ brand: "Nike", model: "페가수스 41" }, "picker"), /is-failed/);
});

test("sitemap includes exactly the root and all current product URLs", () => {
  const sitemap = fs.readFileSync(path.join(__dirname, "..", "sitemap.xml"), "utf8");
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, data.shoes.length + 1);
  for (const value of data.shoes) assert.ok(sitemap.includes(routes.ORIGIN + routes.pathFor(value)));
});
