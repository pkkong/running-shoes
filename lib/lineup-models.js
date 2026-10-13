(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RUNNING_MODEL_IDENTITY = api;
})(typeof window === "object" ? window : globalThis, function () {
  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  }

  // These are spelling/name aliases, never a guess based on a shared word.
  const aliases = {
    Nike: { 줌스트릭플라이: "스트릭플라이" },
    Adidas: { 프로아디오스: "아디오스 프로", 에보1: "프로 에보 1", 에보2: "프로 에보 2" },
    Saucony: { "25허리케인": "허리케인 25" },
    Mizuno: { 인스파이어20: "웨이브 인스파이어 20", 인스파이어21: "웨이브 인스파이어 21" },
  };

  function canonicalText(brand, model) {
    let value = String(model || "").trim().replace(/\s*\(사전 드로우\)\s*/gi, "");
    if (brand === "New Balance") value = value.replace(/^(?:프레시폼|프레시|퓨어셀)\s*/i, "");
    return aliases[brand]?.[normalize(value)] || value;
  }

  function modelKey(brand, model) {
    return `${normalize(brand)}:${normalize(canonicalText(brand, model))}`;
  }

  function familyKey(brand, model) {
    let value = canonicalText(brand, model);
    value = value.replace(/\bv\s*\d+\b/gi, "").replace(/v\d+$/i, "");
    value = value.replace(/\s+\d+(?:\.\d+)?\b/g, "");
    if (!/^씨엘로\s*x1\b/i.test(value)) value = value.replace(/\bx\s*\d+\b/gi, "X");
    value = value.replace(/\bgts\s*\d+\b/gi, "GTS");
    return `${normalize(brand)}:${normalize(value)}`;
  }

  function createIndex(shoes, periods, entries) {
    const byModel = new Map();
    const byPeriodBrand = new Map();
    const timelineCache = new Map();
    for (const shoe of shoes) {
      for (const name of [shoe.model, shoe.displayName].filter(Boolean)) {
        const key = modelKey(shoe.brand, name);
        const previous = byModel.get(key);
        if (previous && previous.id !== shoe.id) throw new Error(`Ambiguous model identity: ${key}`);
        byModel.set(key, shoe);
      }
    }
    for (const entry of entries) {
      const [periodId, brand, category, models] = Array.isArray(entry)
        ? entry : [entry.periodId, entry.brand, entry.category, entry.models];
      const key = `${periodId}:${brand}`;
      const values = byPeriodBrand.get(key) || [];
      values.push(...models.map((model) => ({ model, category })));
      byPeriodBrand.set(key, values);
    }

    function findCurrent(brand, model) {
      return byModel.get(modelKey(brand, model)) || null;
    }

    function timelineFor(shoe, { scope = "model", throughPeriodId = "" } = {}) {
      const keyFor = scope === "family" ? familyKey : modelKey;
      const identity = keyFor(shoe.brand, shoe.model);
      const cacheKey = `${scope}:${identity}:${throughPeriodId}`;
      if (timelineCache.has(cacheKey)) return timelineCache.get(cacheKey);
      const lastIndex = periods.findIndex((period) => period.id === throughPeriodId);
      const visiblePeriods = lastIndex < 0 ? periods : periods.slice(0, lastIndex + 1);
      const timeline = visiblePeriods.map((period) => {
        const records = (byPeriodBrand.get(`${period.id}:${shoe.brand}`) || [])
          .filter(({ model }) => keyFor(shoe.brand, model) === identity);
        const models = [...new Set(records.map(({ model }) => model))];
        return { period, models, matched: models.length > 0 };
      });
      const matchedPeriods = timeline.filter((item) => item.matched);
      let streak = 0;
      for (let index = timeline.length - 1; index >= 0 && timeline[index].matched; index -= 1) streak += 1;
      const result = { timeline, matchedPeriods, count: matchedPeriods.length, streak,
        firstPeriod: matchedPeriods[0]?.period || null, isNew: matchedPeriods.length === 1 };
      timelineCache.set(cacheKey, result);
      return result;
    }

    return { findCurrent, timelineFor };
  }

  return { normalize, modelKey, familyKey, createIndex };
});
