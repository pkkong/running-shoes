import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL("data/shoes.js", root), "utf8"), context);
const shoes = context.window.RUNNING_SHOES;
const periods = context.window.RUNNING_LINEUP_PERIODS;
let marked = 0;

for (const shoe of shoes) {
  const evidence = shoe.runRepeatEvidence;
  const hasMarker = shoe.tags.includes("runRepeatGreat");
  assert.equal(Boolean(evidence), hasMarker, `${shoe.id}: marker/evidence mismatch`);
  if (!evidence) continue;

  const period = periods.find(({ id }) => id === evidence.periodId);
  assert.ok(period, `${shoe.id}: missing source period`);
  assert.equal(evidence.kind, "chart-threshold");
  assert.equal(evidence.sourceUrl, period.sourcePostUrl);
  assert.match(evidence.asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(evidence.asOf.startsWith(period.id));
  assert.ok(Number.isInteger(evidence.threshold) && evidence.threshold > 0 && evidence.threshold <= 100);
  assert.equal(Object.hasOwn(evidence, "score"), false, "A threshold is not an exact score");
  marked += 1;
}

const appPath = fileURLToPath(new URL("app.js", root));
const app = readFileSync(appPath, "utf8");
assert.doesNotMatch(app, /runningFitScoreFor|런리핏 \$\{score\}/, "Synthetic RunRepeat scores must not return");
assert.equal((app.match(/\$\{featureBadgesMarkup\(shoe\)\}/g) || []).length, 2, "List and detail must share badge rendering");
console.log(`RunRepeat evidence: ${marked}/${shoes.length} chart markers with dated sources; no synthetic scores.`);
