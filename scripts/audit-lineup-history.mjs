import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = { window: {} };

function loadScript(path) {
  vm.runInNewContext(readFileSync(path, "utf8"), context, { filename: path });
}

loadScript("data/shoes.js");
loadScript("data/lineup-history.js");

const shoes = context.window.RUNNING_SHOES || [];
const history = context.window.RUNNING_LINEUP_HISTORY || {};
const periods = history.periods || [];
const entries = history.entries || [];
const failures = [];

function fail(message) {
  failures.push(message);
}

if (periods.length !== 8) {
  fail(`Expected 8 periods, found ${periods.length}`);
}

const periodIds = new Set(periods.map((period) => period.id));
const brands = new Set(shoes.map((shoe) => shoe.brand));
const categories = new Set(shoes.map((shoe) => shoe.category));
const activePeriod = periods.find((period) => period.active);
const metadataPattern = /(런갤|런리핏|Great|이상|선호|디시인사이드)/i;
const ocrNoisePatterns = [
  /^[0-9]+(?:\.[0-9]+)?$/,
  /[?？]/,
  /원/,
  /_/,
  /\.\s*$/,
  /\.00\b/,
  /\b[1-9]00\b/,
  /\d\s+0\b/,
  /V\d+\s*0\b/i,
];

if (!activePeriod) {
  fail("Missing active history period");
}

entries.forEach((entry, index) => {
  const [periodId, brand, category, models] = entry;
  if (!periodIds.has(periodId)) fail(`Entry ${index} has unknown period: ${periodId}`);
  if (!brands.has(brand)) fail(`Entry ${index} has unknown brand: ${brand}`);
  if (!categories.has(category)) fail(`Entry ${index} has unknown category: ${category}`);
  if (!Array.isArray(models) || models.length === 0) fail(`Entry ${index} has no models`);
  models.forEach((model, modelIndex) => {
    if (!String(model || "").trim()) fail(`Entry ${index} model ${modelIndex} is empty`);
    if (metadataPattern.test(model)) fail(`Entry ${index} model ${modelIndex} looks like metadata: ${model}`);
    if (ocrNoisePatterns.some((pattern) => pattern.test(model))) {
      fail(`Entry ${index} model ${modelIndex} has suspicious OCR residue: ${model}`);
    }
  });
});

if (activePeriod) {
  const currentEntries = entries.filter(([periodId]) => periodId === activePeriod.id);
  const currentModels = currentEntries.flatMap(([, , , models]) => models);
  const currentModelSet = new Set(currentModels);

  if (currentModels.length !== shoes.length) {
    fail(`Current period model count mismatch: history=${currentModels.length}, shoes=${shoes.length}`);
  }

  shoes.forEach((shoe) => {
    if (!currentModelSet.has(shoe.model)) {
      fail(`Current period missing shoe model: ${shoe.brand} ${shoe.model}`);
    }
  });
}

const periodStats = periods.map((period) => {
  const periodEntries = entries.filter(([periodId]) => periodId === period.id);
  const modelCount = periodEntries.reduce((sum, [, , , models]) => sum + models.length, 0);
  if (modelCount === 0) fail(`Period ${period.id} has no structured models`);
  return {
    id: period.id,
    cells: periodEntries.length,
    models: modelCount,
  };
});

if (failures.length) {
  console.error("Lineup history audit failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("Lineup history audit passed");
periodStats.forEach((stats) => {
  console.log(`${stats.id}: ${stats.models} models in ${stats.cells} cells`);
});
