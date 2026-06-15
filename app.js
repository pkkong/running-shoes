(function () {
  const shoes = window.RUNNING_SHOES || [];
  const periods = window.RUNNING_LINEUP_PERIODS || [];
  const lineupHistory = window.RUNNING_LINEUP_HISTORY || { periods: [], entries: [] };
  const priceQueryConfig = window.RUNNING_PRICE_QUERY_CONFIG || {};

  const ALL_PERIOD_ID = "__all_periods__";
  const ALL_BRAND_VALUE = "전체";
  const brandOrder = ["Nike", "Adidas", "ASICS", "New Balance", "Saucony", "Puma", "HOKA", "Brooks", "Mizuno", "On"];
  const pickerBrandOptions = [ALL_BRAND_VALUE, ...brandOrder];
  const groupOrder = ["데일리", "슈퍼 트레이너", "레이싱"];
  const categoryOrder = [
    "입문화",
    "맥스 쿠션화",
    "안정화",
    "올라운더",
    "경량 트레이너",
    "논 플레이트",
    "라이트 플레이트",
    "카본 플레이트",
    "중거리",
    "장거리",
  ];
  const pickerCategoryOptions = ["전체", ...categoryOrder];

  const tagMeta = {
    runGalleryPick: { label: "런갤러 선호", className: "tag--green" },
    runRepeatGreat: { label: "런리핏 86+", className: "tag--blue" },
    newProduct: { label: "신제품", className: "tag--red" },
  };

  const changeOptions = [
    { value: "전체", label: "전체" },
    { value: "new", label: "신규" },
    { value: "continued", label: "유지" },
    { value: "returned", label: "복귀" },
    { value: "dropped", label: "제외" },
    { value: "consecutive", label: "연속" },
  ];

  const mapGroupLabels = {
    "슈퍼 트레이너": "슈퍼트레이너",
  };

  const mapCategoryLabels = {
    "맥스 쿠션화": "맥스쿠션화",
    "경량 트레이너": "경량 트레이너",
    "논 플레이트": "논 플레이트",
    "라이트 플레이트": "라이트 플레이트",
    "카본 플레이트": "카본 플레이트",
    중거리: "중거리",
    장거리: "장거리",
  };

  const state = {
    query: "",
    brand: "전체",
    group: "전체",
    category: "전체",
    periodId: "",
    change: "전체",
    tags: new Set(),
    sort: "table",
    mapZoom: 1,
    pickerBrandIndex: 0,
    pickerCategoryIndex: 0,
    pickerAxesReady: false,
    pickerFilterPanel: "",
    route: "picker",
    detailId: "",
    lastBrowseRoute: "#/",
    selectedCell: null,
    lastFocus: null,
    mapRaf: 0,
  };

  const el = {
    filterPanel: document.querySelector("#filterPanel"),
    periodArchive: document.querySelector("#periodArchive"),
    globalViewNav: document.querySelector(".global-view-nav"),
    homeView: document.querySelector("#homeView"),
    overviewView: document.querySelector("#overviewView"),
    pickerView: document.querySelector("#pickerView"),
    detailView: document.querySelector("#detailView"),
    searchInput: document.querySelector("#searchInput"),
    brandFilters: document.querySelector("#brandFilters"),
    groupFilters: document.querySelector("#groupFilters"),
    categoryFilters: document.querySelector("#categoryFilters"),
    tagFilters: document.querySelector("#tagFilters"),
    changeFilters: document.querySelector("#changeFilters"),
    shoeGrid: document.querySelector("#shoeGrid"),
    emptyState: document.querySelector("#emptyState"),
    overviewTitle: document.querySelector("#overviewTitle"),
    resultTitle: document.querySelector("#resultTitle"),
    sortSelect: document.querySelector("#sortSelect"),
    resetButton: document.querySelector("#resetButton"),
    overviewLink: document.querySelector("#overviewLink"),
    pickerLink: document.querySelector("#pickerLink"),
    mapControlPanel: document.querySelector("#mapControlPanel"),
    mapGroupFilters: document.querySelector("#mapGroupFilters"),
    mapBrandFilters: document.querySelector("#mapBrandFilters"),
    mapChangeFilters: document.querySelector("#mapChangeFilters"),
    mapSearchInput: document.querySelector("#mapSearchInput"),
    mapSummary: document.querySelector("#mapSummary"),
    mapViewShell: document.querySelector("#mapViewShell"),
    mapViewport: document.querySelector("#mapViewport"),
    shoeMapCanvas: document.querySelector("#shoeMapCanvas"),
    mapMiniMap: document.querySelector("#mapMiniMap"),
    zoomOutButton: document.querySelector("#zoomOutButton"),
    zoomResetButton: document.querySelector("#zoomResetButton"),
    zoomInButton: document.querySelector("#zoomInButton"),
    mapSheetBackdrop: document.querySelector("#mapSheetBackdrop"),
    mapSheet: document.querySelector("#mapSheet"),
    topbarContext: document.querySelector("#topbarContext"),
    pickerCoordinate: document.querySelector("#pickerCoordinate"),
    pickerSummary: document.querySelector("#pickerSummary"),
    pickerPeriodTrigger: document.querySelector("#pickerPeriodTrigger"),
    pickerCategoryTrigger: document.querySelector("#pickerCategoryTrigger"),
    pickerPeriodPanel: document.querySelector("#pickerPeriodPanel"),
    pickerCategoryPanel: document.querySelector("#pickerCategoryPanel"),
    pickerBrandAxis: document.querySelector("#pickerBrandAxis"),
    pickerCategoryAxis: document.querySelector("#pickerCategoryAxis"),
    pickerDetail: document.querySelector("#pickerDetail"),
  };

  function setHidden(node, hidden) {
    if (node) node.hidden = hidden;
  }

  const categoryGroupMap = shoes.reduce((acc, shoe) => {
    acc[shoe.category] = shoe.categoryGroup;
    return acc;
  }, {});

  const historyPeriods = lineupHistory.periods?.length ? lineupHistory.periods : periods;
  const historyEntries = (lineupHistory.entries || []).map(([periodId, brand, category, models]) => ({
    periodId,
    brand,
    category,
    models,
  }));
  const historyEntryMap = historyEntries.reduce((acc, entry) => {
    acc.set(`${entry.periodId}|||${entry.brand}|||${entry.category}`, entry);
    return acc;
  }, new Map());
  const historyStatsByPeriod = historyEntries.reduce((acc, entry) => {
    const stats = acc.get(entry.periodId) || { cells: 0, models: 0 };
    if (entry.models.length) stats.cells += 1;
    stats.models += entry.models.length;
    acc.set(entry.periodId, stats);
    return acc;
  }, new Map());
  const activeHistoryPeriod = historyPeriods.find((period) => period.active) || historyPeriods[historyPeriods.length - 1] || null;
  const historyTotalModelCount = [...historyStatsByPeriod.values()].reduce((sum, stats) => sum + stats.models, 0);
  const modelNameCollator = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });
  let allPeriodLineupCache = null;
  state.periodId = activeHistoryPeriod?.id || historyPeriods[historyPeriods.length - 1]?.id || "";

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeHistoryText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[·+]/g, " ")
      .replace(/[^a-z0-9가-힣]+/g, "")
      .trim();
  }

  function lineageText(value) {
    let text = String(value || "")
      .replace(/[·+]/g, " ")
      .replace(/\bV\s*\d+\b/gi, "")
      .replace(/\bX\s*(\d+)\b/gi, "X")
      .replace(/\bGTS\s*\d+\b/gi, "GTS")
      .replace(/\s+\d+(\.\d+)?\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/^\d+$/.test(String(value).trim().split(/\s+/)[0] || "")) {
      text = String(value).trim().split(/\s+/)[0];
    }

    return text;
  }

  function lineKey(value) {
    return normalizeHistoryText(lineageText(value));
  }

  function lineKeyMatches(left, right) {
    const a = normalizeHistoryText(left);
    const b = normalizeHistoryText(right);
    if (a.length < 2 || b.length < 2) return false;
    if (a === b) return true;
    return a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
  }

  function usefulModelKey(value) {
    const key = normalizeHistoryText(value);
    if (!key) return "";
    if (/^(v\d+|ls|ld|gts|pl|x|sl)$/i.test(key)) return "";
    if (/새로업데이트된신제품|업데이트|신제품만/.test(key)) return "";
    return key;
  }

  function modelMatchKeys(value) {
    const keys = new Set();
    [value, lineageText(value), lineKey(value)]
      .map(usefulModelKey)
      .filter(Boolean)
      .forEach((key) => keys.add(key));

    String(value || "")
      .split(/[\s·+/_-]+/)
      .map(usefulModelKey)
      .filter((key) => key.length >= 2 && !/^\d$/.test(key))
      .forEach((key) => keys.add(key));

    return [...keys];
  }

  function looseModelKeyMatches(left, right) {
    const a = usefulModelKey(left);
    const b = usefulModelKey(right);
    if (a.length < 2 || b.length < 2) return false;
    if (a === b) return true;
    if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true;

    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    return /[가-힣]/.test(shorter) && shorter.length >= 2 && longer.includes(shorter);
  }

  function modelLooksLikeSameLine(shoe, model) {
    const modelKeys = modelMatchKeys(model);
    const shoeKeys = [
      ...modelMatchKeys(shoe.model),
      ...modelMatchKeys(shoe.displayName),
      ...historyAliases(shoe),
    ].filter(Boolean);

    return shoeKeys.some((shoeKey) => modelKeys.some((modelKey) => looseModelKeyMatches(shoeKey, modelKey)));
  }

  function historyAliases(shoe) {
    const aliases = new Set();
    [shoe.model, shoe.displayName, lineageText(shoe.model), lineageText(shoe.displayName)]
      .filter(Boolean)
      .forEach((value) => {
        aliases.add(normalizeHistoryText(value));
        const firstToken = String(value).trim().split(/\s+/)[0];
        if (firstToken && firstToken.length >= 3 && !/^\d+$/.test(firstToken)) {
          aliases.add(normalizeHistoryText(firstToken));
        }
      });
    return [...aliases].filter((alias) => alias.length >= 2);
  }

  function historyEntryFor(periodId, brand, category) {
    return historyEntryMap.get(`${periodId}|||${brand}|||${category}`) || null;
  }

  function historyTimelineFor(shoe) {
    const aliases = [lineKey(shoe.model), lineKey(shoe.displayName)].filter(Boolean);
    const timeline = historyPeriods.map((period) => {
      const entry = historyEntryFor(period.id, shoe.brand, shoe.category);
      const models = entry?.models || [];
      const matched = models.some((model) => {
        const normalized = lineKey(model);
        return aliases.some((alias) => lineKeyMatches(normalized, alias));
      });
      return {
        period,
        models,
        matched,
      };
    });

    let streak = 0;
    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      if (!timeline[index].matched) break;
      streak += 1;
    }

    const matchedPeriods = timeline.filter((item) => item.matched);
    return {
      timeline,
      matchedPeriods,
      count: matchedPeriods.length,
      streak,
      firstPeriod: matchedPeriods[0]?.period || null,
      isNew: matchedPeriods.length <= 1,
    };
  }

  function historyBadgeMarkup(shoe) {
    const history = historyTimelineFor(shoe);
    if (!history.count) return "";
    const label = history.isNew
      ? "신규 라인"
      : history.streak >= 2
        ? `${history.streak}분기 연속`
        : `${history.count}회 등장`;
    return `<span class="history-pill">${escapeHtml(label)}</span>`;
  }

  function historyModelsMarkup(models, maxItems = 4) {
    if (!models.length) return `<span class="history-period__empty">기록 없음</span>`;
    const visibleModels = models.slice(0, maxItems);
    const restCount = models.length - visibleModels.length;
    return `
      ${visibleModels.map((model) => `<span>${escapeHtml(model)}</span>`).join("")}
      ${restCount > 0 ? `<span class="history-period__more">+${restCount}</span>` : ""}
    `;
  }

  function historySummaryFor(shoe) {
    const history = historyTimelineFor(shoe);
    const firstPeriod = history.firstPeriod;
    const latestPeriod = history.matchedPeriods[history.matchedPeriods.length - 1]?.period || null;
    const firstLabel = firstPeriod?.label || "첫 등장 미확인";
    const latestLabel = latestPeriod?.label || "최근 추천표 미포함";
    const streakLabel = history.streak >= 2 ? `${history.streak}분기 연속` : history.isNew && history.count ? "신규 등장" : history.count ? "간헐 등장" : "등장 없음";
    const badgeLabel = history.count
      ? history.isNew
        ? "추천표 신규 등장"
        : history.streak >= 2
          ? `추천표 ${history.streak}분기 연속 등장`
          : `추천표 ${history.count}회 등장`
      : "추천표 이력 확인 필요";
    const headline = history.count
      ? history.isNew
        ? `${latestLabel} 추천표에 새로 등장한 라인입니다.`
        : `${firstLabel}부터 ${history.count}개 분기 동안 추천표에 등장했습니다.`
      : "추천표 이력이 아직 충분히 정리되지 않았습니다.";

    return {
      ...history,
      firstLabel,
      latestLabel,
      streakLabel,
      badgeLabel,
      headline,
    };
  }

  function categoryInsightText(shoe) {
    const copyByCategory = {
      입문화: "처음 달리기를 시작하거나 매일 편하게 신기 좋은 데일리 러닝화입니다.",
      "맥스 쿠션화": "긴 거리와 회복주에서 푹신함을 우선하는 쿠션 중심 러닝화입니다.",
      안정화: "발의 흔들림을 줄이고 안정적인 착지를 돕는 안정성 중심 러닝화입니다.",
      올라운더: "조깅부터 가벼운 템포까지 폭넓게 쓰기 좋은 올라운더입니다.",
      "경량 트레이너": "가볍게 페이스를 올리는 훈련에 어울리는 경량 데일리화입니다.",
      "논 플레이트": "플레이트 없이 쿠션과 반발을 챙긴 슈퍼 트레이너입니다.",
      "라이트 플레이트": "부담이 낮은 플레이트로 템포주와 장거리 훈련을 보조합니다.",
      "카본 플레이트": "강한 반발과 추진력을 노린 고성능 훈련화입니다.",
      중거리: "5K~10K처럼 빠른 페이스에 맞춘 레이싱화입니다.",
      장거리: "하프부터 마라톤까지 긴 레이스를 염두에 둔 레이싱화입니다.",
    };

    return copyByCategory[shoe.category] || `${shoe.categoryGroup} 용도에 맞춰 추천표에 정리된 러닝화입니다.`;
  }

  function dropDisplayText(shoe) {
    return Number.isFinite(shoe.dropMm) ? `${shoe.dropMm}mm` : "미정";
  }

  function dropInsightText(shoe) {
    if (!Number.isFinite(shoe.dropMm)) return "공식 드롭 수치가 아직 정리되지 않았습니다.";
    if (shoe.dropMm >= 10) return "일반적인 데일리화보다 높은 편이라 뒤꿈치 착지에 익숙한 러너가 적응하기 쉽습니다.";
    if (shoe.dropMm >= 7) return "대부분의 러너가 적응하기 쉬운 중간 드롭입니다.";
    if (shoe.dropMm >= 4) return "지면 감각이 조금 더 살아나는 낮은 편의 드롭입니다.";
    return "낮은 드롭이라 종아리와 발목 부담을 고려해 천천히 적응하는 편이 좋습니다.";
  }

  function detailSummaryMarkup(shoe) {
    const history = historySummaryFor(shoe);
    const items = [
      ["분류", `${shoe.categoryGroup} · ${shoe.category}`, "추천표의 용도 기준"],
      ["드롭", dropDisplayText(shoe), dropInsightText(shoe)],
      ["추천표", history.count ? `${history.count}개 분기 등장` : "이력 확인 필요", history.streakLabel],
      ["최근", history.latestLabel, history.count ? "추천표 포함" : "추천표 미확인"],
    ];

    return `
      <section class="detail-summary" aria-label="핵심 정보">
        ${items
          .map(
            ([label, value, note]) => `
              <span class="detail-summary__item">
                <small>${escapeHtml(label)}</small>
                <strong>${escapeHtml(value)}</strong>
                <em>${escapeHtml(note)}</em>
              </span>
            `
          )
          .join("")}
      </section>
    `;
  }

  function detailActionsMarkup(shoe) {
    const officialUrl = shoe.officialProductUrl || shoe.imageSourceUrl;

    return `
      <div class="detail-actions">
        <a class="detail-action detail-action--primary" href="#price-check">
          <span>가격 확인</span>
          <strong>플랫폼 검색</strong>
          <small>네이버 · 쿠팡</small>
        </a>
        <a class="detail-action detail-action--secondary" href="${escapeHtml(officialUrl)}" target="_blank" rel="noreferrer">
          <span>공식 제품 페이지</span>
          <strong>브랜드 출처</strong>
          <small>공식 링크</small>
        </a>
      </div>
    `;
  }

  function historyPanelMarkup(shoe) {
    const history = historySummaryFor(shoe);
    if (!history.timeline.length) return "";

    return `
      <section class="history-panel history-panel--v2" aria-label="추천표 이력">
        <div class="history-panel__head">
          <div>
            <h3>추천표 이력</h3>
            <p>${escapeHtml(history.headline)}</p>
          </div>
          <span class="history-pill">${escapeHtml(history.badgeLabel)}</span>
        </div>
        <div class="history-stats" aria-label="라인 이력 요약">
          <span>
            <strong>${escapeHtml(String(history.count))}</strong>
            <small>등장 분기</small>
          </span>
          <span>
            <strong>${escapeHtml(history.streakLabel)}</strong>
            <small>최근 흐름</small>
          </span>
          <span>
            <strong>${escapeHtml(history.latestLabel)}</strong>
            <small>최근 등장</small>
          </span>
        </div>
        <details class="history-timeline-disclosure">
          <summary>전체 분기 기록 보기</summary>
          <ol class="history-timeline">
            ${history.timeline
              .map(
                ({ period, models, matched }) => `
                  <li class="history-period ${matched ? "is-matched" : ""}">
                    <span class="history-period__date">${escapeHtml(period.label || period.id)}</span>
                    <span class="history-period__status">${matched ? "추천표 포함" : models.length ? "같은 구역 기록" : "기록 없음"}</span>
                    <span class="history-period__models">${historyModelsMarkup(models, 3)}</span>
                  </li>
                `
              )
              .join("")}
          </ol>
        </details>
        <p class="history-panel__note">
          디시인사이드 러닝 갤러리 추천표를 브랜드와 용도 기준으로 정리했습니다.
        </p>
      </section>
    `;
  }

  function selectedHistoryPeriod() {
    return historyPeriods.find((period) => period.id === state.periodId) || activeHistoryPeriod || historyPeriods[historyPeriods.length - 1] || null;
  }

  function isAllPeriodsSelected() {
    return state.periodId === ALL_PERIOD_ID;
  }

  function historyPeriodRangeLabel() {
    if (!historyPeriods.length) return "";
    const first = historyPeriods[0]?.label || historyPeriods[0]?.id || "";
    const latest = historyPeriods[historyPeriods.length - 1]?.label || historyPeriods[historyPeriods.length - 1]?.id || "";
    return first && latest ? `${first}~${latest}` : first || latest;
  }

  function selectedPickerPeriodLabel() {
    return isAllPeriodsSelected() ? "전체 기간" : selectedHistoryPeriod()?.label || "";
  }

  function historyPeriodIndex(periodId) {
    return historyPeriods.findIndex((period) => period.id === periodId);
  }

  function previousHistoryPeriod(periodId) {
    const index = historyPeriodIndex(periodId);
    return index > 0 ? historyPeriods[index - 1] : null;
  }

  function changeOptionLabel(value) {
    return changeOptions.find((option) => option.value === value)?.label || value;
  }

  function isLineupModelValue(model) {
    const value = String(model || "").trim();
    return Boolean(value) && !/(런갤|런리핏|Great|이상|선호|디시인사이드)/i.test(value);
  }

  function findCurrentShoeForHistory(brand, category, model) {
    const exactModel = normalizeHistoryText(model);
    const sameCell = shoes.filter((shoe) => shoe.brand === brand && shoe.category === category);
    const sameBrand = shoes.filter((shoe) => shoe.brand === brand);
    return (
      sameCell.find((shoe) => normalizeHistoryText(shoe.model) === exactModel || normalizeHistoryText(shoe.displayName) === exactModel) ||
      sameCell.find((shoe) => [lineKey(shoe.model), lineKey(shoe.displayName)].some((key) => lineKeyMatches(key, lineKey(model)))) ||
      sameCell.find((shoe) => modelLooksLikeSameLine(shoe, model)) ||
      sameBrand.find((shoe) => normalizeHistoryText(shoe.model) === exactModel || normalizeHistoryText(shoe.displayName) === exactModel) ||
      sameBrand.find((shoe) => [lineKey(shoe.model), lineKey(shoe.displayName)].some((key) => lineKeyMatches(key, lineKey(model)))) ||
      sameBrand.find((shoe) => modelLooksLikeSameLine(shoe, model)) ||
      null
    );
  }

  function historyItemId(periodId, brand, category, model) {
    return `history-${[periodId, brand, category, model].map((value) => normalizeHistoryText(value) || "item").join("-")}`;
  }

  function createLineupItem({ periodId, brand, category, model, tableOrder, changeStatus = "" }) {
    const period = historyPeriods.find((item) => item.id === periodId) || selectedHistoryPeriod();
    const currentShoe = findCurrentShoeForHistory(brand, category, model);
    const exactCurrent =
      periodId === activeHistoryPeriod?.id &&
      currentShoe &&
      (normalizeHistoryText(currentShoe.model) === normalizeHistoryText(model) ||
        normalizeHistoryText(currentShoe.displayName) === normalizeHistoryText(model));
    const imageSource = currentShoe || {};

    return {
      ...(exactCurrent ? currentShoe : {}),
      id: exactCurrent ? currentShoe.id : historyItemId(periodId, brand, category, model),
      detailId: currentShoe?.id || "",
      brand,
      model,
      displayName: exactCurrent ? currentShoe.displayName || currentShoe.model : model,
      categoryGroup: categoryGroupMap[category] || currentShoe?.categoryGroup || "",
      category,
      dropMm: exactCurrent ? currentShoe.dropMm : null,
      tags: exactCurrent ? currentShoe.tags || [] : [],
      imageUrl: imageSource.imageUrl || "",
      imageFit: imageSource.imageFit || "contain",
      imagePosition: imageSource.imagePosition || "center",
      imageScale: imageSource.imageScale || 1,
      tableOrder,
      priceStatus: exactCurrent ? currentShoe.priceStatus : "planned",
      periodId,
      periodLabel: period?.label || periodId,
      changeStatus,
      isHistoryItem: !exactCurrent,
      hasCurrentDetail: Boolean(currentShoe),
      hasCurrentData: Boolean(exactCurrent),
    };
  }

  function periodLineupItems(periodId) {
    let order = 0;
    return historyEntries
      .filter((entry) => entry.periodId === periodId)
      .flatMap((entry) =>
        entry.models.filter(isLineupModelValue).map((model) =>
          createLineupItem({
            periodId,
            brand: entry.brand,
            category: entry.category,
            model,
            tableOrder: order++,
          })
        )
      );
  }

  function allPeriodLineupItems() {
    if (allPeriodLineupCache) return allPeriodLineupCache;

    const groups = new Map();
    let sourceOrder = 0;

    historyEntries.forEach((entry) => {
      const periodIndex = historyPeriodIndex(entry.periodId);
      const period = historyPeriods[periodIndex];
      if (!period) return;

      entry.models.filter(isLineupModelValue).forEach((model) => {
        const modelKey = lineKey(model) || normalizeHistoryText(model);
        const key = `${entry.brand}|||${entry.category}|||${modelKey}`;
        const group =
          groups.get(key) ||
          {
            brand: entry.brand,
            category: entry.category,
            modelKey,
            firstPeriod: period,
            firstPeriodIndex: periodIndex,
            latestPeriod: period,
            latestPeriodIndex: periodIndex,
            latestModel: model,
            latestSourceOrder: sourceOrder,
            periodIds: new Set(),
          };

        group.periodIds.add(period.id);

        if (periodIndex < group.firstPeriodIndex) {
          group.firstPeriod = period;
          group.firstPeriodIndex = periodIndex;
        }

        if (periodIndex > group.latestPeriodIndex || (periodIndex === group.latestPeriodIndex && sourceOrder > group.latestSourceOrder)) {
          group.latestPeriod = period;
          group.latestPeriodIndex = periodIndex;
          group.latestModel = model;
          group.latestSourceOrder = sourceOrder;
        }

        groups.set(key, group);
        sourceOrder += 1;
      });
    });

    allPeriodLineupCache = [...groups.values()].map((group, index) => {
      const item = createLineupItem({
        periodId: group.latestPeriod.id,
        brand: group.brand,
        category: group.category,
        model: group.latestModel,
        tableOrder: index,
      });

      return {
        ...item,
        id: `archive-${[group.brand, group.category, group.modelKey || index].map((value) => normalizeHistoryText(value) || "item").join("-")}`,
        periodLabel: `최근 ${group.latestPeriod.label || group.latestPeriod.id}`,
        archivePeriodRange: `${group.firstPeriod.label || group.firstPeriod.id}~${group.latestPeriod.label || group.latestPeriod.id}`,
        archiveAppearanceCount: group.periodIds.size,
        archiveFirstPeriodId: group.firstPeriod.id,
        archiveFirstPeriodLabel: group.firstPeriod.label || group.firstPeriod.id,
        archiveLatestPeriodId: group.latestPeriod.id,
        archiveLatestPeriodLabel: group.latestPeriod.label || group.latestPeriod.id,
        isAllPeriodItem: true,
      };
    });

    return allPeriodLineupCache;
  }

  function linePresenceFor(brand, category, model) {
    const targetKey = lineKey(model);
    return historyPeriods.map((period) => {
      const entry = historyEntryFor(period.id, brand, category);
      const matchedModels = (entry?.models || []).filter((candidate) => isLineupModelValue(candidate) && lineKeyMatches(lineKey(candidate), targetKey));
      return {
        period,
        matched: matchedModels.length > 0,
        models: matchedModels,
      };
    });
  }

  function changeInfoForItem(item) {
    if (item.changeStatus === "dropped") {
      return {
        status: "dropped",
        label: "제외",
        streak: 0,
      };
    }

    const periodId = item.periodId || state.periodId;
    const periodIndex = historyPeriodIndex(periodId);
    const presence = linePresenceFor(item.brand, item.category, item.model);
    const appears = presence[periodIndex]?.matched;
    const previousAppears = periodIndex > 0 && presence[periodIndex - 1]?.matched;
    const earlierAppears = periodIndex > 0 && presence.slice(0, periodIndex).some((entry) => entry.matched);

    let streak = 0;
    if (appears) {
      for (let index = periodIndex; index >= 0; index -= 1) {
        if (!presence[index]?.matched) break;
        streak += 1;
      }
    }

    let status = "new";
    if (periodIndex > 0 && previousAppears) {
      status = "continued";
    } else if (earlierAppears) {
      status = "returned";
    }

    const label =
      status === "new"
        ? periodIndex === 0
          ? "첫 기록"
          : "신규"
        : status === "returned"
          ? "복귀"
          : streak >= 2
            ? `${streak}분기 연속`
            : "유지";

    return {
      status,
      label,
      streak,
    };
  }

  function changeBadgeMarkup(item, compact = false) {
    const info = changeInfoForItem(item);
    if (!info.label) return "";
    const className = info.streak >= 2 && info.status === "continued" ? "consecutive" : info.status;
    return `<span class="change-pill change-pill--${className} ${compact ? "change-pill--compact" : ""}">${escapeHtml(info.label)}</span>`;
  }

  function droppedLineupItems(periodId) {
    const previousPeriod = previousHistoryPeriod(periodId);
    if (!previousPeriod) return [];

    const dropped = [];
    const seen = new Set();
    let order = 0;

    historyEntries
      .filter((entry) => entry.periodId === previousPeriod.id)
      .forEach((entry) => {
        entry.models.filter(isLineupModelValue).forEach((model) => {
          const key = `${entry.brand}|||${entry.category}|||${lineKey(model)}`;
          const appearsInSelected = linePresenceFor(entry.brand, entry.category, model)[historyPeriodIndex(periodId)]?.matched;
          if (appearsInSelected || seen.has(key)) return;
          seen.add(key);
          dropped.push(
            createLineupItem({
              periodId,
              brand: entry.brand,
              category: entry.category,
              model,
              tableOrder: order++,
              changeStatus: "dropped",
            })
          );
        });
      });

    return dropped;
  }

  function matchesChangeFilter(item) {
    if (state.change === "전체") return true;
    const info = changeInfoForItem(item);
    if (state.change === "consecutive") return info.status !== "dropped" && info.streak >= 2;
    return info.status === state.change;
  }

  function baseLineupItemsForSelectedPeriod() {
    if (isAllPeriodsSelected()) {
      return allPeriodLineupItems();
    }
    const period = selectedHistoryPeriod();
    if (!period) return [];
    if (state.change === "dropped") return droppedLineupItems(period.id);
    return periodLineupItems(period.id).filter(matchesChangeFilter);
  }

  function sortAllPeriodItems(items, brandFilter) {
    return [...items].sort((a, b) => {
      const brandDiff = brandFilter === ALL_BRAND_VALUE ? brandOrder.indexOf(a.brand) - brandOrder.indexOf(b.brand) : 0;
      const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
      const latestDiff = historyPeriodIndex(b.archiveLatestPeriodId || b.periodId) - historyPeriodIndex(a.archiveLatestPeriodId || a.periodId);
      const nameDiff = modelNameCollator.compare(a.displayName || a.model, b.displayName || b.model);
      return brandDiff || categoryDiff || latestDiff || nameDiff;
    });
  }

  function periodChangeSummary(periodId) {
    const previous = previousHistoryPeriod(periodId);
    const summary = {
      new: 0,
      continued: 0,
      returned: 0,
      dropped: droppedLineupItems(periodId).length,
      consecutive: 0,
    };

    periodLineupItems(periodId).forEach((item) => {
      const info = changeInfoForItem(item);
      summary[info.status] += 1;
      if (info.streak >= 2) summary.consecutive += 1;
    });

    return {
      ...summary,
      hasPrevious: Boolean(previous),
    };
  }

  function cellChangeSummary(items) {
    if (!items.length) return "";
    const infos = items.map(changeInfoForItem);
    const dropped = infos.filter((info) => info.status === "dropped").length;
    const added = infos.filter((info) => info.status === "new").length;
    const returned = infos.filter((info) => info.status === "returned").length;
    const maxStreak = Math.max(0, ...infos.map((info) => info.streak || 0));
    if (dropped) return `${dropped}개 제외`;
    if (added) return `신규 ${added}`;
    if (returned) return `복귀 ${returned}`;
    if (maxStreak >= 2) return `${maxStreak}분기 연속`;
    return "유지";
  }

  function groupClassName(group) {
    return `matrix-row--${normalize(group)}`;
  }

  function isGroupStartCategory(category) {
    const index = categoryOrder.indexOf(category);
    if (index <= 0) return false;
    return categoryGroupMap[category] !== categoryGroupMap[categoryOrder[index - 1]];
  }

  function getFilteredShoes() {
    const query = normalize(state.query);

    return baseLineupItemsForSelectedPeriod()
      .filter((shoe) => {
        const haystack = normalize([shoe.brand, shoe.model, shoe.displayName, shoe.categoryGroup, shoe.category].join(" "));
        const matchesQuery = !query || haystack.includes(query);
        const matchesBrand = state.brand === "전체" || shoe.brand === state.brand;
        const matchesGroup = state.group === "전체" || shoe.categoryGroup === state.group;
        const matchesCategory = state.category === "전체" || shoe.category === state.category;
        const matchesTags = [...state.tags].every((tag) => shoe.tags.includes(tag));
        return matchesQuery && matchesBrand && matchesGroup && matchesCategory && matchesTags;
      })
      .sort((a, b) => {
        if (state.sort === "brand") {
          return brandOrder.indexOf(a.brand) - brandOrder.indexOf(b.brand) || a.tableOrder - b.tableOrder;
        }
        if (state.sort === "category") {
          return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || a.tableOrder - b.tableOrder;
        }
        if (state.sort === "drop") {
          const ad = a.dropMm ?? 99;
          const bd = b.dropMm ?? 99;
          return ad - bd || a.tableOrder - b.tableOrder;
        }
        return a.tableOrder - b.tableOrder;
      });
  }

  function getMapFilteredShoes() {
    const period = selectedHistoryPeriod();
    return period ? periodLineupItems(period.id).sort((a, b) => a.tableOrder - b.tableOrder) : [];
  }

  function getMapVisibleBrands() {
    return brandOrder;
  }

  function getMapVisibleRows() {
    return categoryOrder
      .map((category) => ({
        category,
        group: categoryGroupMap[category],
        label: mapCategoryLabels[category] || category,
      }));
  }

  function groupLabel(group) {
    return mapGroupLabels[group] || group;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function renderChoiceButtons(container, options, activeValue, onSelect) {
    container.innerHTML = options
      .map(
        (option) => `
          <button class="chip ${option === activeValue ? "is-active" : ""}" type="button" data-value="${escapeHtml(option)}">
            ${escapeHtml(option)}
          </button>
        `
      )
      .join("");

    container.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => onSelect(button.dataset.value));
    });
  }

  function renderSegmentButtons(container, options, activeValue, onSelect, getLabel = (option) => option) {
    container.innerHTML = options
      .map((option) => {
        const value = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? getLabel(option) : option.label;
        return `
          <button
            class="segment-button ${value === activeValue ? "is-active" : ""}"
            type="button"
            data-value="${escapeHtml(value)}"
            aria-pressed="${value === activeValue ? "true" : "false"}"
          >
            ${escapeHtml(label)}
          </button>
        `;
      })
      .join("");

    container.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => onSelect(button.dataset.value));
    });
  }

  function renderTagButtons() {
    el.tagFilters.innerHTML = Object.entries(tagMeta)
      .map(
        ([key, meta]) => `
          <button class="chip chip--tag ${state.tags.has(key) ? "is-active" : ""}" type="button" data-value="${key}">
            <span class="dot ${meta.className}"></span>
            ${escapeHtml(meta.label)}
          </button>
        `
      )
      .join("");

    el.tagFilters.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.value;
        if (state.tags.has(value)) {
          state.tags.delete(value);
        } else {
          state.tags.add(value);
        }
        renderCurrentRoute();
      });
    });
  }

  function renderChangeButtons(container, renderer = "chip") {
    if (!container) return;
    const onSelect = (value) => {
      state.change = value;
      renderCurrentRoute();
    };
    if (renderer === "segment") {
      renderSegmentButtons(container, changeOptions, state.change, onSelect);
      return;
    }
    container.innerHTML = changeOptions
      .map(
        (option) => `
          <button class="chip ${option.value === state.change ? "is-active" : ""}" type="button" data-value="${escapeHtml(option.value)}">
            ${escapeHtml(option.label)}
          </button>
        `
      )
      .join("");

    container.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => onSelect(button.dataset.value));
    });
  }

  function updateScrollRailState(wrapper) {
    const rail = wrapper.querySelector("[data-scroll-rail]");
    if (!rail) return;

    const isScrollable = rail.scrollWidth > rail.clientWidth + 2;
    wrapper.classList.toggle("is-scrollable", isScrollable);

    wrapper.querySelectorAll(".scroll-rail-button").forEach((button) => {
      button.disabled = !isScrollable;
    });
  }

  function navigateScrollRail(rail, direction) {
    if (rail === el.pickerBrandAxis) {
      selectPickerAxis("brand", state.pickerBrandIndex + direction);
      return;
    }

    if (rail === el.pickerCategoryAxis) {
      selectPickerAxis("category", state.pickerCategoryIndex + direction);
      return;
    }

    if (rail.classList.contains("period-archive__rail")) {
      const buttons = [...rail.querySelectorAll("[data-period-id]")];
      const activeIndex = buttons.findIndex((button) => button.classList.contains("is-active"));
      const nextButton = buttons[(activeIndex + direction + buttons.length) % buttons.length];
      nextButton?.click();
      nextButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      return;
    }

    rail.scrollBy({
      left: direction * Math.max(160, rail.clientWidth * 0.74),
      behavior: "smooth",
    });
  }

  function ensureScrollRail(rail, kind, label) {
    if (!rail) return;

    let wrapper = rail.parentElement?.classList.contains("scroll-rail-shell") ? rail.parentElement : null;
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = `scroll-rail-shell scroll-rail-shell--${kind}`;
      rail.parentNode.insertBefore(wrapper, rail);
      wrapper.appendChild(rail);
    }

    rail.dataset.scrollRail = kind;
    wrapper.classList.add(`scroll-rail-shell--${kind}`);

    if (!wrapper.querySelector(".scroll-rail-button--prev")) {
      const prev = document.createElement("button");
      prev.className = "scroll-rail-button scroll-rail-button--prev";
      prev.type = "button";
      prev.setAttribute("aria-label", `${label} 이전 항목 보기`);
      prev.innerHTML = `<span aria-hidden="true">‹</span>`;

      const next = document.createElement("button");
      next.className = "scroll-rail-button scroll-rail-button--next";
      next.type = "button";
      next.setAttribute("aria-label", `${label} 다음 항목 보기`);
      next.innerHTML = `<span aria-hidden="true">›</span>`;

      prev.addEventListener("click", () => navigateScrollRail(rail, -1));
      next.addEventListener("click", () => navigateScrollRail(rail, 1));
      rail.addEventListener(
        "scroll",
        () => {
          window.requestAnimationFrame(() => updateScrollRailState(wrapper));
        },
        { passive: true }
      );

      wrapper.prepend(prev);
      wrapper.append(next);
    }

    window.requestAnimationFrame(() => updateScrollRailState(wrapper));
  }

  function syncScrollRails() {
    return;
  }

  function tagMarkup(tags, compact = false) {
    if (!tags.length) {
      return "";
    }

    return tags
      .map((tag) => {
        const meta = tagMeta[tag];
        return compact
          ? `<span class="tag-dot ${meta.className}" title="${escapeHtml(meta.label)}"></span>`
          : `<span class="tag ${meta.className}">${escapeHtml(meta.label)}</span>`;
      })
      .join("");
  }

  function dropMarkup(shoe, label = true) {
    const value = Number.isFinite(shoe.dropMm) ? `${shoe.dropMm}` : "-";
    return `<span class="drop-value"><span>${label ? "드롭 " : ""}</span><b>${value}</b><span>mm</span></span>`;
  }

  function shoppingSearchQuery(shoe) {
    const override = priceQueryConfig.overrides?.[shoe.id] || {};
    if (override.query) return override.query;
    const brand = override.brand || priceQueryConfig.brandQueryNames?.[shoe.brand] || shoe.brand;
    const suffix = override.suffix ?? priceQueryConfig.defaultSuffix ?? "러닝화";
    return [brand, override.model || shoe.model, suffix].filter(Boolean).join(" ");
  }

  function naverShoppingSearchUrl(shoe) {
    const query = shoppingSearchQuery(shoe);
    const params = new URLSearchParams({
      query,
      origQuery: query,
      adQuery: query,
      pagingIndex: "1",
      pagingSize: "40",
      productSet: "total",
      sort: "price_asc",
      viewType: "list",
    });
    return `https://search.shopping.naver.com/search/all?${params.toString()}`;
  }

  function coupangSearchUrl(shoe) {
    const params = new URLSearchParams({
      q: shoppingSearchQuery(shoe),
      channel: "user",
    });
    return `https://www.coupang.com/np/search?${params.toString()}`;
  }

  function platformSearchLinksFor(shoe) {
    return [
      {
        id: "naver",
        label: "네이버",
        note: "가격순 검색",
        url: naverShoppingSearchUrl(shoe),
        primary: true,
      },
      {
        id: "coupang",
        label: "쿠팡",
        note: "검색 결과",
        url: coupangSearchUrl(shoe),
        primary: true,
      },
      {
        id: "toss",
        label: "토스쇼핑",
        note: "앱 검색 준비중",
        url: "",
        disabled: true,
      },
    ];
  }

  function platformSearchLinksMarkup(shoe, variant = "panel") {
    const platforms = platformSearchLinksFor(shoe).filter((platform) => variant !== "picker" || !platform.disabled);
    return platforms
      .map((platform) => {
        const className = `platform-search-link platform-search-link--${platform.id} platform-search-link--${variant}${
          platform.disabled ? " platform-search-link--disabled" : ""
        }`;
        const body = `
          <span>${escapeHtml(platform.label)}</span>
          <small>${escapeHtml(platform.note)}</small>
        `;
        if (platform.disabled) {
          return `<button class="${className}" type="button" disabled aria-label="${escapeHtml(`${platform.label} 검색 링크 준비중`)}">${body}</button>`;
        }
        return `
          <a
            class="${className}"
            href="${escapeHtml(platform.url)}"
            target="_blank"
            rel="noreferrer"
            aria-label="${escapeHtml(`${shoe.brand} ${shoe.model} ${platform.label}에서 직접 확인`)}"
          >
            ${body}
          </a>
        `;
      })
      .join("");
  }

  function pickerPriceActionMarkup(shoe) {
    return `
      <div class="picker-platform-links" aria-label="${escapeHtml(`${shoe.brand} ${shoe.model} 가격 직접 확인`)}">
        ${platformSearchLinksMarkup(shoe, "picker")}
      </div>
    `;
  }

  function priceBadgeMarkup(shoe, showPending = true, mode = "span") {
    if (!showPending) {
      return "";
    }
    return `<span class="price-pill price-pill--pending">가격 직접 확인</span>`;
  }

  function imageMarkup(shoe, variant) {
    const imageStyle = [
      `--shoe-fit: ${shoe.imageFit || "contain"}`,
      `--shoe-position: ${shoe.imagePosition || "center"}`,
      `--shoe-scale: ${shoe.imageScale || 1}`,
    ].join("; ");

    return `
      <div class="shoe-image shoe-image--${variant}" style="${escapeHtml(imageStyle)}">
        <div class="shoe-image__placeholder">
          <strong>${escapeHtml(shoe.brand)}</strong>
          <span>${escapeHtml(shoe.model)}</span>
        </div>
        ${
          shoe.imageUrl
            ? `<img
                src="${escapeHtml(shoe.imageUrl)}"
                alt="${escapeHtml(`${shoe.brand} ${shoe.model}`)}"
                loading="lazy"
                decoding="async"
                data-shoe-image
              />`
            : ""
        }
      </div>
    `;
  }

  function mapImageMarkup(shoe) {
    const imageStyle = [
      `--shoe-fit: ${shoe.imageFit || "contain"}`,
      `--shoe-position: ${shoe.imagePosition || "center"}`,
      `--shoe-scale: ${shoe.imageScale || 1}`,
    ].join("; ");

    return `
      <span class="shoe-image shoe-image--map" style="${escapeHtml(imageStyle)}">
        <span class="shoe-image__placeholder">
          <strong>${escapeHtml(shoe.brand)}</strong>
          <span>${escapeHtml(shoe.displayName || shoe.model)}</span>
        </span>
        ${
          shoe.imageUrl
            ? `<img
                src="${escapeHtml(shoe.imageUrl)}"
                alt="${escapeHtml(`${shoe.brand} ${shoe.model}`)}"
                loading="lazy"
                decoding="async"
                data-shoe-image
              />`
            : ""
        }
      </span>
    `;
  }

  function detailHrefForItem(item) {
    return item.detailId ? `#/shoe/${encodeURIComponent(item.detailId)}` : "";
  }

  function cardMarkup(shoe) {
    const href = detailHrefForItem(shoe);
    const openTag = href ? `<a class="shoe-card" href="${escapeHtml(href)}">` : `<article class="shoe-card shoe-card--static">`;
    const closeTag = href ? "</a>" : "</article>";

    return `
      ${openTag}
        ${imageMarkup(shoe, "card")}
        <span class="shoe-card__body">
          <span class="shoe-card__brand">${brandLogoMarkup(shoe.brand)}</span>
          <strong>${escapeHtml(shoe.model)}</strong>
          <span class="shoe-card__meta">
            <span>${escapeHtml(shoe.categoryGroup)}</span>
            <span>${escapeHtml(shoe.category)}</span>
            <span>${escapeHtml(shoe.periodLabel || selectedHistoryPeriod()?.label || "")}</span>
          </span>
          ${changeBadgeMarkup(shoe)}
          <span class="tag-list">${tagMarkup(shoe.tags)}</span>
          ${shoe.hasCurrentData ? priceBadgeMarkup(shoe, false, "inlineLink") : ""}
        </span>
      ${closeTag}
    `;
  }

  function cellIntensity(count, maxCount) {
    if (!count) return "map-cell--empty";
    if (count >= Math.max(4, maxCount * 0.72)) return "map-cell--high";
    if (count >= 2) return "map-cell--medium";
    return "map-cell--low";
  }

  function cellProductNames(items) {
    if (!items.length) return "";
    return items.map((item) => item.displayName || item.model).join(" · ");
  }

  function buildMapCellData(items, brands, rows) {
    const cellMap = new Map();
    items.forEach((shoe) => {
      const key = `${shoe.brand}|||${shoe.category}`;
      if (!cellMap.has(key)) {
        cellMap.set(key, []);
      }
      cellMap.get(key).push(shoe);
    });

    return rows.map((row) => ({
      ...row,
      cells: brands.map((brand) => {
        const cellShoes = cellMap.get(`${brand}|||${row.category}`) || [];
        return {
          brand,
          category: row.category,
          row,
          shoes: cellShoes,
          count: cellShoes.length,
          productNames: cellProductNames(cellShoes),
        };
      }),
    }));
  }

  function mapColumnWidthToken(count) {
    if (count >= 3) return "var(--map-cell-width-3)";
    if (count >= 2) return "var(--map-cell-width-2)";
    return "var(--map-cell-width-1)";
  }

  function renderMapControls() {
    renderSegmentButtons(el.mapGroupFilters, ["전체", ...groupOrder], state.group, (value) => {
      state.group = value;
      renderOverview();
    }, (value) => (value === "전체" ? "전체 용도" : groupLabel(value)));

    renderSegmentButtons(el.mapBrandFilters, ["전체", ...brandOrder], state.brand, (value) => {
      state.brand = value;
      renderOverview();
    }, (value) => (value === "전체" ? "전체 브랜드" : value));

    renderChangeButtons(el.mapChangeFilters, "segment");

    if (document.activeElement !== el.mapSearchInput) {
      el.mapSearchInput.value = state.query;
    }
    syncScrollRails();
  }

  function renderShoeMap(items) {
    const brands = getMapVisibleBrands();
    const rows = getMapVisibleRows();
    const rowData = buildMapCellData(items, brands, rows);
    const maxCount = Math.max(1, ...rowData.flatMap((row) => row.cells.map((cell) => cell.count)));
    const brandMaxCounts = brands.map((_, index) => Math.max(0, ...rowData.map((row) => row.cells[index]?.count || 0)));
    const gridColumns = `var(--map-row-width) ${brandMaxCounts.map(mapColumnWidthToken).join(" ")}`;
    const totalCells = brands.length * rows.length;
    const filledCells = rowData.flatMap((row) => row.cells).filter((cell) => cell.count > 0).length;

    el.mapSummary.textContent = `${selectedHistoryPeriod()?.label || ""} · ${changeOptionLabel(state.change)} · ${items.length}개 제품 · ${filledCells}/${totalCells}개 구역`;
    el.shoeMapCanvas.style.setProperty("--map-zoom", state.mapZoom);
    el.shoeMapCanvas.innerHTML = `
      <div class="shoe-map-grid" style="grid-template-columns: ${escapeHtml(gridColumns)};">
        <div class="map-axis-corner"><span class="visually-hidden">용도</span></div>
        ${brands
          .map(
            (brand) => `
              <div class="map-brand-head">
                ${brandLogoMarkup(brand)}
                <span class="visually-hidden">${escapeHtml(brand)}</span>
              </div>
            `
          )
          .join("")}
        ${rowData
          .map(
            (row) => `
              <div class="map-row-head ${groupClassName(row.group)} ${
                isGroupStartCategory(row.category) ? "map-row-head--group-start" : ""
              }">
                ${
                  isGroupStartCategory(row.category)
                    ? `<span class="map-row-head__group">${escapeHtml(groupLabel(row.group))}</span>`
                    : ""
                }
                <strong title="${escapeHtml(`${groupLabel(row.group)} · ${row.label}`)}">${escapeHtml(row.label)}</strong>
              </div>
              ${row.cells
                .map((cell) => {
                  const disabled = cell.count === 0;
                  const visibleShoes = cell.shoes.slice(0, 3);
                  const mediaClass = `map-cell__media map-cell__media--${Math.min(Math.max(cell.count, 1), 3)}`;
                  const primaryLabel = cell.shoes[0] ? cell.shoes[0].displayName || cell.shoes[0].model : "";
                  const changeLabel = cellChangeSummary(cell.shoes);
                  const label = disabled
                    ? `${cell.brand} ${row.label} 제품 없음`
                    : `${cell.brand} ${row.label} ${cell.count}개: ${cell.productNames}. 자세히 보기`;
                  return `
                    <button
                      class="map-cell ${cellIntensity(cell.count, maxCount)} ${cell.count > 1 ? "map-cell--multi" : ""} ${
                        isGroupStartCategory(row.category) ? "map-cell--group-start" : ""
                      }"
                      type="button"
                      data-map-cell="true"
                      data-brand="${escapeHtml(cell.brand)}"
                      data-category="${escapeHtml(row.category)}"
                      aria-label="${escapeHtml(label)}"
                      ${disabled ? "disabled" : ""}
                    >
                      ${
                        cell.count
                          ? `<span class="${mediaClass}">
                              ${visibleShoes.map(mapImageMarkup).join("")}
                              ${
                                cell.count > 1
                                  ? `<span class="map-cell__badge" aria-hidden="true">${cell.count}</span>`
                                  : ""
                              }
                        </span>`
                          : ""
                      }
                      <span class="map-cell__body">
                        <span class="map-cell__count">${
                          cell.count ? escapeHtml(cell.count === 1 ? primaryLabel : `${cell.count}개 제품`) : "없음"
                        }</span>
                        ${changeLabel ? `<span class="map-cell__change">${escapeHtml(changeLabel)}</span>` : ""}
                        <span class="map-cell__name">
                          ${cell.count ? escapeHtml(cell.count === 1 ? row.label : "눌러서 보기") : "제품 없음"}
                        </span>
                      </span>
                    </button>
                  `;
                })
                .join("")}
            `
          )
          .join("")}
      </div>
    `;

    renderMiniMap(rowData, brands);
    applyMapZoom();
    updateMiniMapViewport();
  }

  function renderMiniMap(rowData, brands) {
    el.mapMiniMap.innerHTML = `
      <span class="map-minimap__label">미니맵</span>
      <span class="map-minimap__frame">
        <span class="map-minimap__grid" style="grid-template-columns: repeat(${brands.length}, 1fr); grid-template-rows: repeat(${rowData.length}, 1fr);">
          ${rowData
            .flatMap((row) =>
              row.cells.map((cell) => `<span class="map-minimap__cell ${cell.count ? "is-filled" : ""}"></span>`)
            )
            .join("")}
        </span>
        <span class="map-minimap__window"></span>
      </span>
    `;
  }

  function updateMiniMapViewport() {
    if (!el.mapViewport || !el.mapMiniMap) return;
    const indicator = el.mapMiniMap.querySelector(".map-minimap__window");
    if (!indicator) return;

    const maxScrollLeft = Math.max(1, el.mapViewport.scrollWidth - el.mapViewport.clientWidth);
    const maxScrollTop = Math.max(1, el.mapViewport.scrollHeight - el.mapViewport.clientHeight);
    const width = clamp((el.mapViewport.clientWidth / el.mapViewport.scrollWidth) * 100, 12, 100);
    const height = clamp((el.mapViewport.clientHeight / el.mapViewport.scrollHeight) * 100, 16, 100);
    const left = clamp((el.mapViewport.scrollLeft / maxScrollLeft) * (100 - width), 0, 100 - width);
    const top = clamp((el.mapViewport.scrollTop / maxScrollTop) * (100 - height), 0, 100 - height);

    indicator.style.left = `${left}%`;
    indicator.style.top = `${top}%`;
    indicator.style.width = `${width}%`;
    indicator.style.height = `${height}%`;
  }

  function scheduleMiniMapUpdate() {
    if (state.mapRaf) return;
    state.mapRaf = window.requestAnimationFrame(() => {
      state.mapRaf = 0;
      updateMiniMapViewport();
    });
  }

  function applyMapZoom() {
    el.shoeMapCanvas.style.setProperty("--map-zoom", state.mapZoom);
    el.zoomOutButton.disabled = state.mapZoom <= 0.75;
    el.zoomInButton.disabled = state.mapZoom >= 1.5;
    el.zoomResetButton.title = `현재 배율 ${Math.round(state.mapZoom * 100)}%`;
    scheduleMiniMapUpdate();
  }

  function changeMapZoom(nextZoom) {
    state.mapZoom = clamp(nextZoom, 0.75, 1.5);
    applyMapZoom();
  }

  function renderResults(items) {
    el.shoeGrid.innerHTML = items.map(cardMarkup).join("");
    el.emptyState.hidden = items.length !== 0;
    el.shoeGrid.hidden = items.length === 0;
  }

  function renderFilters() {
    const baseItems = baseLineupItemsForSelectedPeriod();
    const categoryOptions =
      state.group === "전체"
        ? categoryOrder
        : categoryOrder.filter((category) => baseItems.some((shoe) => shoe.categoryGroup === state.group && shoe.category === category));

    if (state.category !== "전체" && !categoryOptions.includes(state.category)) {
      state.category = "전체";
    }

    renderChoiceButtons(el.brandFilters, ["전체", ...brandOrder], state.brand, (value) => {
      state.brand = value;
      renderCurrentRoute();
    });
    renderChoiceButtons(el.groupFilters, ["전체", ...groupOrder], state.group, (value) => {
      state.group = value;
      renderCurrentRoute();
    });
    renderChoiceButtons(el.categoryFilters, ["전체", ...categoryOptions], state.category, (value) => {
      state.category = value;
      renderCurrentRoute();
    });
    renderTagButtons();
    renderChangeButtons(el.changeFilters);
  }

  function renderPeriodArchive() {
    if (!el.periodArchive || !historyPeriods.length) return;
    const active = selectedHistoryPeriod();
    const summary = periodChangeSummary(active.id);
    const sourceLinks = [...historyPeriods]
      .reverse()
      .map((period) => {
        const stats = historyStatsByPeriod.get(period.id);
        const status = `${stats?.models || (period.active ? shoes.length : 0)}개 모델`;
        return `
          <button
            class="period-link ${period.id === active.id ? "is-active" : ""}"
            type="button"
            data-period-id="${escapeHtml(period.id)}"
            aria-label="${escapeHtml(`${period.label} 러닝화 라인업 선택`)}"
          >
            <span>${escapeHtml(period.label)}</span>
            <small>${escapeHtml(status)}</small>
          </button>
        `;
      })
      .join("");

    el.periodArchive.innerHTML = `
      <div class="period-archive__head">
        <div>
          <p class="eyebrow">Archive</p>
          <h2>분기별 추천 변화</h2>
          <p>
            ${escapeHtml(active.label)} 기준
            신규 ${summary.new} · 유지 ${summary.continued} · 복귀 ${summary.returned} · 제외 ${summary.dropped}
          </p>
        </div>
        <div class="period-archive__actions">
          <a class="period-source" href="${escapeHtml(active.sourcePostUrl)}" target="_blank" rel="noreferrer">디시인사이드 러닝 갤러리 원문</a>
        </div>
      </div>
      <div class="period-archive__meta" aria-label="분기 구조화 요약">
        <span>${historyPeriods.length}개 분기</span>
        <span>총 ${historyTotalModelCount}개 모델 후보</span>
        <span>추천표 정리 데이터</span>
      </div>
      <div class="period-archive__rail" aria-label="분기 선택">
        ${sourceLinks}
      </div>
    `;
    syncScrollRails();
  }

  function closePickerFilterPanels() {
    state.pickerFilterPanel = "";
    renderPickerControls();
  }

  function setPickerFilterPanel(panel) {
    state.pickerFilterPanel = state.pickerFilterPanel === panel ? "" : panel;
    renderPickerControls();
  }

  function selectPickerPeriod(periodId) {
    state.periodId = periodId;
    state.change = "전체";
    state.tags.clear();
    state.pickerFilterPanel = "";
    renderPeriodArchive();
    renderPicker();
  }

  function pickerFilterButtonMarkup({ active, label, subLabel, value, attr }) {
    return `
      <button
        class="picker-filter-option ${active ? "is-active" : ""}"
        type="button"
        ${attr}="${escapeHtml(value)}"
        aria-pressed="${active ? "true" : "false"}"
      >
        <span>${escapeHtml(label)}</span>
        ${subLabel ? `<small>${escapeHtml(subLabel)}</small>` : ""}
      </button>
    `;
  }

  function renderPickerControls() {
    if (!el.pickerPeriodTrigger || !el.pickerCategoryTrigger) return;

    const activePeriod = selectedHistoryPeriod();
    const category = selectedPickerCategory();
    const brand = selectedPickerBrand();
    const count = pickerProducts().length;
    const periodPanelOpen = state.pickerFilterPanel === "period";
    const categoryPanelOpen = state.pickerFilterPanel === "category";

    el.pickerPeriodTrigger.innerHTML = `
      <span>시기</span>
      <strong>${escapeHtml(selectedPickerPeriodLabel() || activePeriod?.label || "선택")}</strong>
    `;
    el.pickerPeriodTrigger.classList.toggle("is-open", periodPanelOpen);
    el.pickerPeriodTrigger.setAttribute("aria-expanded", periodPanelOpen ? "true" : "false");
    el.pickerPeriodTrigger.setAttribute("aria-label", `시기 ${selectedPickerPeriodLabel() || activePeriod?.label || "선택"} ${count}개 제품`);

    el.pickerCategoryTrigger.innerHTML = `
      <span>종류</span>
      <strong>${escapeHtml(pickerCategoryLabel(category))}</strong>
    `;
    el.pickerCategoryTrigger.classList.toggle("is-open", categoryPanelOpen);
    el.pickerCategoryTrigger.setAttribute("aria-expanded", categoryPanelOpen ? "true" : "false");
    el.pickerCategoryTrigger.setAttribute("aria-label", `${brand} ${pickerCategoryLabel(category)} ${count}개 제품`);

    el.pickerPeriodPanel.hidden = !periodPanelOpen;
    el.pickerCategoryPanel.hidden = !categoryPanelOpen;

    if (periodPanelOpen) {
      const allPeriodSubLabel = `${historyPeriodRangeLabel()} · ${historyPeriods.length}개 분기`;
      el.pickerPeriodPanel.innerHTML = `
        <div class="picker-filter-panel__grid picker-filter-panel__grid--period">
          ${pickerFilterButtonMarkup({
            active: isAllPeriodsSelected(),
            label: "전체 기간",
            subLabel: allPeriodSubLabel,
            value: ALL_PERIOD_ID,
            attr: "data-picker-period-id",
          })}
          ${[...historyPeriods]
            .reverse()
            .map((period) => {
              const stats = historyStatsByPeriod.get(period.id);
              return pickerFilterButtonMarkup({
                active: !isAllPeriodsSelected() && period.id === activePeriod?.id,
                label: period.label,
                subLabel: `${stats?.models || 0}개`,
                value: period.id,
                attr: "data-picker-period-id",
              });
            })
            .join("")}
        </div>
      `;
    } else {
      el.pickerPeriodPanel.innerHTML = "";
    }

    if (categoryPanelOpen) {
      el.pickerCategoryPanel.innerHTML = `
        <div class="picker-filter-panel__grid picker-filter-panel__grid--category">
          ${pickerCategoryOptions
            .map((option, index) =>
              pickerFilterButtonMarkup({
                active: index === state.pickerCategoryIndex,
                label: pickerAxisCategoryLabel(option),
                subLabel: option === "전체" ? "전체 종류" : categoryGroupMap[option] || "",
                value: index,
                attr: "data-picker-category-index",
              })
            )
            .join("")}
        </div>
      `;
    } else {
      el.pickerCategoryPanel.innerHTML = "";
    }
  }

  function titleForActiveFilters() {
    const titleParts = [state.brand, state.group, state.category].filter((value) => value !== "전체");
    const periodLabel = selectedHistoryPeriod()?.label || "";
    const changeLabel = state.change === "전체" ? "" : changeOptionLabel(state.change);
    const baseTitle = titleParts.length ? titleParts.join(" · ") : "라인업 전체";
    return [periodLabel, changeLabel, baseTitle].filter(Boolean).join(" · ");
  }

  function updateViewLinks() {
    if (!el.overviewLink || !el.pickerLink) return;
    const activeRoute = state.route === "detail" ? "picker" : state.route;
    el.overviewLink.classList.toggle("is-active", activeRoute === "overview");
    el.pickerLink.classList.toggle("is-active", activeRoute === "picker");
  }

  function setRoute(route) {
    state.route = route;
    document.body.dataset.route = route;
  }

  function renderCurrentRoute() {
    if (state.route === "picker") {
      renderPicker();
      return;
    }
    if (state.route === "home") {
      renderHome();
    }
  }

  function renderHome() {
    const items = getFilteredShoes();
    el.resultTitle.textContent = titleForActiveFilters();
    renderFilters();
    updateViewLinks();
    renderResults(items);
    wireImages();
  }

  function renderOverview() {
    const items = getMapFilteredShoes();
    el.overviewTitle.textContent = `${selectedHistoryPeriod()?.label || ""} 러닝화 맵`;
    updateViewLinks();
    renderMapControls();
    el.mapViewShell.hidden = false;
    renderShoeMap(items);
    wireImages();
  }

  function pickerCategoryLabel(category) {
    if (category === "전체") return "전체";
    return mapCategoryLabels[category] || category;
  }

  function pickerAxisCategoryLabel(category) {
    if (category === "전체") return "전체";
    return (
      {
        "맥스 쿠션화": "맥스쿠션",
        "경량 트레이너": "경량",
        "논 플레이트": "논PL",
        "라이트 플레이트": "라이트PL",
        "카본 플레이트": "카본PL",
      }[category] || pickerCategoryLabel(category)
    );
  }

  function brandLogoMarkup(brand) {
    const logos = {
      Nike: "assets/logos/nike.png",
      Adidas: "assets/logos/adidas.svg",
      ASICS: "assets/logos/asics.svg",
      "New Balance": "assets/logos/new-balance.svg",
      Saucony: "assets/logos/saucony.svg",
      Puma: "assets/logos/puma.svg",
      HOKA: "assets/logos/hoka.svg",
      Brooks: "assets/logos/brooks.svg",
      Mizuno: "assets/logos/mizuno-wordmark.svg",
      On: "assets/logos/on-wordmark.svg",
    };
    const source = logos[brand];
    const fallback = escapeHtml(brand);
    const logo = source
      ? `<img class="brand-logo__image" src="${source}" alt="" decoding="async" onerror="this.closest('.brand-logo').classList.add('is-missing'); this.remove();" />`
      : "";
    return `<span class="brand-logo brand-logo--${normalize(brand)}" aria-hidden="true">${logo}<span class="brand-logo__fallback">${fallback}</span></span>`;
  }

  function pickerBrandLabel(brand) {
    return brand === ALL_BRAND_VALUE ? "전체 브랜드" : brand;
  }

  function pickerBrandVisualMarkup(brand) {
    if (brand === ALL_BRAND_VALUE) {
      return `
        <span class="picker-brand-token picker-brand-token--all">
          <span class="picker-brand-token__mark">
            <span class="brand-logo brand-logo--all" aria-hidden="true"><span class="brand-logo__fallback">ALL</span></span>
          </span>
          <span class="picker-brand-token__label">전체</span>
        </span>
      `;
    }

    return `
      <span class="picker-brand-token">
        <span class="picker-brand-token__mark">${brandLogoMarkup(brand)}</span>
        <span class="picker-brand-token__label">${escapeHtml(brand)}</span>
      </span>
    `;
  }

  function selectedPickerBrand() {
    return pickerBrandOptions[state.pickerBrandIndex] || ALL_BRAND_VALUE;
  }

  function selectedPickerCategory() {
    return pickerCategoryOptions[state.pickerCategoryIndex] || pickerCategoryOptions[0];
  }

  function pickerProducts() {
    const brand = selectedPickerBrand();
    const category = selectedPickerCategory();
    const products = baseLineupItemsForSelectedPeriod().filter((shoe) => {
      const matchesBrand = brand === ALL_BRAND_VALUE || shoe.brand === brand;
      const matchesCategory = category === "전체" || shoe.category === category;
      return matchesBrand && matchesCategory;
    });

    return isAllPeriodsSelected() ? sortAllPeriodItems(products, brand) : products;
  }

  function pickerAxisItems(values, axis) {
    return values
      .map((value, logicalIndex) => {
        const label = axis === "category" ? pickerAxisCategoryLabel(value) : value;
        const ariaLabel = axis === "category" ? pickerCategoryLabel(value) : pickerBrandLabel(value);
        const visual = axis === "brand" ? pickerBrandVisualMarkup(value) : escapeHtml(label);
        const groupStartClass =
          axis === "category" && value !== "전체" && isGroupStartCategory(value) ? " picker-axis-item--group-start" : "";
        return `
          <button
            id="picker-${axis}-option-${logicalIndex}"
            class="picker-axis-item${groupStartClass}"
            type="button"
            role="option"
            data-axis="${axis}"
            data-logical-index="${logicalIndex}"
            aria-selected="false"
            aria-label="${escapeHtml(ariaLabel)}"
          >
            ${visual}
          </button>
        `;
      })
      .join("");
  }

  function renderPickerAxes() {
    if (state.pickerAxesReady) return;
    el.pickerBrandAxis.innerHTML = pickerAxisItems(pickerBrandOptions, "brand");
    el.pickerCategoryAxis.innerHTML = pickerAxisItems(pickerCategoryOptions, "category");
    state.pickerAxesReady = true;
    syncScrollRails();
  }

  function pickerAxisContainer(axis) {
    return axis === "brand" ? el.pickerBrandAxis : el.pickerCategoryAxis;
  }

  function pickerAxisIndex(axis) {
    return axis === "brand" ? state.pickerBrandIndex : state.pickerCategoryIndex;
  }

  function setPickerAxisIndex(axis, index) {
    if (axis === "brand") {
      state.pickerBrandIndex = index;
    } else {
      state.pickerCategoryIndex = index;
    }
  }

  function pickerAxisLength(axis) {
    return axis === "brand" ? pickerBrandOptions.length : pickerCategoryOptions.length;
  }

  function revealPickerAxisItem(axis, index, behavior = "smooth") {
    const container = pickerAxisContainer(axis);
    const target = container.querySelector(`[data-axis="${axis}"][data-logical-index="${index}"]`);
    if (!target) return;

    target.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  }

  function updatePickerAxisState(axis) {
    const container = pickerAxisContainer(axis);
    const selectedIndex = pickerAxisIndex(axis);
    container.setAttribute("aria-activedescendant", `picker-${axis}-option-${selectedIndex}`);
    container.querySelectorAll(`[data-axis="${axis}"]`).forEach((item) => {
      const isSelected = Number(item.dataset.logicalIndex) === selectedIndex;
      item.classList.toggle("is-selected", isSelected);
      item.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
    syncScrollRails();
  }

  function renderPickerDetail() {
    const brand = selectedPickerBrand();
    const category = selectedPickerCategory();
    const products = pickerProducts();
    const brandLabel = pickerBrandLabel(brand);
    const categoryLabel = pickerCategoryLabel(category);
    const coordinate = `${brandLabel} × ${categoryLabel}`;
    const periodLabel = selectedPickerPeriodLabel();
    const countText = products.length ? `${products.length}개 제품` : "라인업 없음";
    el.pickerCoordinate.textContent = coordinate;
    const summaryText = [periodLabel, brandLabel, categoryLabel, countText].filter(Boolean).join(" · ");
    if (el.pickerSummary) {
      el.pickerSummary.textContent = summaryText;
    }
    if (el.topbarContext) {
      el.topbarContext.textContent = summaryText;
    }
    el.pickerDetail.className = `picker-detail-card picker-detail-card--${products.length ? "filled" : "empty"}`;

    el.pickerDetail.innerHTML = `
      <div class="picker-stage" aria-label="${escapeHtml(coordinate)}">
        <strong class="picker-stage__title">${escapeHtml(brandLabel)} · ${escapeHtml(categoryLabel)}</strong>
        <div class="picker-stage__stats" aria-label="${escapeHtml(`${periodLabel} ${countText}`)}">
          <span>${escapeHtml(periodLabel)}</span>
          <span>${escapeHtml(brandLabel)}</span>
          <span>${escapeHtml(categoryLabel)}</span>
          <span>${escapeHtml(countText)}</span>
          ${state.change !== "전체" ? `<span>${escapeHtml(changeOptionLabel(state.change))}</span>` : ""}
        </div>
      </div>
      ${
        products.length
          ? `<div class="picker-product-list">${products.map(pickerProductMarkup).join("")}</div>`
          : `<div class="picker-empty-cell">
              <strong>해당 라인업 없음</strong>
              <span>브랜드 × 카테고리 기준 데이터가 없습니다.</span>
            </div>`
      }
    `;
    wireImages();
  }

  function pickerProductMarkup(shoe) {
    const href = detailHrefForItem(shoe);
    const detailLink = href
      ? `<a class="picker-detail-link" href="${escapeHtml(href)}" aria-label="${escapeHtml(`${shoe.brand} ${shoe.model} 상세 보기`)}">자세히</a>`
      : "";
    const metaMarkup = shoe.isAllPeriodItem
      ? `
          <span class="picker-product-card__meta-period">${escapeHtml(shoe.periodLabel || "")}</span>
          ${shoe.archivePeriodRange ? `<span class="picker-product-card__meta-range">${escapeHtml(shoe.archivePeriodRange)}</span>` : ""}
          ${shoe.archiveAppearanceCount ? `<span class="history-pill">${escapeHtml(`${shoe.archiveAppearanceCount}분기 등장`)}</span>` : ""}
        `
      : `
          <span>${escapeHtml(shoe.periodLabel || selectedHistoryPeriod()?.label || "")}</span>
          ${changeBadgeMarkup(shoe, true)}
        `;
    const subParts = [selectedPickerBrand() === ALL_BRAND_VALUE ? shoe.brand : "", shoe.categoryGroup, shoe.category].filter(Boolean);

    return `
      <article class="picker-product-card ${href ? "" : "picker-product-card--static"}">
        <div class="picker-product-card__media">
          ${imageMarkup(shoe, "picker")}
        </div>
        <div class="picker-product-card__body">
          <span class="picker-product-card__meta">
            ${metaMarkup}
          </span>
          <strong class="picker-product-card__name">${escapeHtml(shoe.displayName || shoe.model)}</strong>
          <span class="picker-product-card__sub">${escapeHtml(subParts.join(" · "))}</span>
          <div class="picker-product-card__actions">
            ${pickerPriceActionMarkup(shoe)}
            ${detailLink}
          </div>
        </div>
      </article>
    `;
  }

  function selectPickerAxis(axis, index, behavior = "smooth") {
    if (state.route !== "picker") return;
    const length = pickerAxisLength(axis);
    const nextIndex = (index + length) % length;
    setPickerAxisIndex(axis, nextIndex);
    if (axis === "category" || axis === "brand") {
      state.pickerFilterPanel = "";
    }
    updatePickerAxisState(axis);
    renderPickerControls();
    renderPickerDetail();
    revealPickerAxisItem(axis, nextIndex, behavior);
  }

  function renderPicker() {
    renderPickerAxes();
    updateViewLinks();
    updatePickerAxisState("brand");
    updatePickerAxisState("category");
    renderPickerControls();
    renderPickerDetail();
  }

  function clearPickerTimers() {
    return;
  }

  function pricePanelMarkup(shoe) {
    return `
      <section id="price-check" class="price-panel price-panel--search price-panel--v2" aria-label="가격 직접 확인">
        <div class="price-panel__head">
          <div>
            <h3>가격 직접 확인</h3>
            <p>최저가를 대신 고르지 않습니다. 각 플랫폼에서 판매처, 사이즈, 배송비를 직접 확인하세요.</p>
          </div>
          <span class="price-pill price-pill--pending">검색 링크</span>
        </div>
        <div class="platform-search-grid">
          ${platformSearchLinksMarkup(shoe, "panel")}
        </div>
        <p class="price-panel__caution">
          가격은 실시간으로 바뀔 수 있고 색상, 성별, 사이즈, 배송비, 판매처가 다를 수 있습니다.
          결제 전 각 플랫폼에서 최종 정보를 확인하세요.
        </p>
      </section>
    `;
  }

  function renderDetail(shoe) {
    const backHref = "#/";
    const backLabel = "라인업으로";
    const history = historySummaryFor(shoe);

    el.detailView.innerHTML = `
      <a class="back-link" href="${escapeHtml(backHref)}">← ${backLabel}</a>
      <article class="detail-card detail-card--v2">
        <div class="detail-card__media">
          ${imageMarkup(shoe, "detail")}
        </div>
        <div class="detail-card__content">
          <div class="detail-brand-line">
            ${brandLogoMarkup(shoe.brand)}
            <span>${escapeHtml(shoe.categoryGroup)} · ${escapeHtml(shoe.category)}</span>
          </div>
          <h2>${escapeHtml(shoe.displayName || shoe.model)}</h2>
          ${
            shoe.displayName && shoe.displayName !== shoe.model
              ? `<p class="detail-card__subtitle">${escapeHtml(shoe.model)}</p>`
              : ""
          }
          <p class="detail-insight">${escapeHtml(categoryInsightText(shoe))}</p>
          <p class="detail-recommendation">${escapeHtml(history.badgeLabel)}</p>
          <div class="tag-list detail-tags">${tagMarkup(shoe.tags)}</div>
          ${detailActionsMarkup(shoe)}
        </div>
      </article>
      ${detailSummaryMarkup(shoe)}
      ${pricePanelMarkup(shoe)}
      ${historyPanelMarkup(shoe)}
    `;
    wireImages();
  }

  function sheetProductMarkup(shoe) {
    const href = detailHrefForItem(shoe);
    const openTag = href ? `<a class="sheet-product" href="${escapeHtml(href)}">` : `<article class="sheet-product sheet-product--static">`;
    const closeTag = href ? "</a>" : "</article>";
    return `
      ${openTag}
        <span class="sheet-product__name">${escapeHtml(shoe.model)}</span>
        <span class="sheet-product__meta">${escapeHtml(shoe.periodLabel || "")} · ${escapeHtml(shoe.categoryGroup)} · ${escapeHtml(shoe.category)}</span>
        ${changeBadgeMarkup(shoe, true)}
        <span class="sheet-product__tags">${tagMarkup(shoe.tags)}</span>
      ${closeTag}
    `;
  }

  function renderMapSheet(cell) {
    const countText = `${cell.shoes.length}개`;
    el.mapSheet.innerHTML = `
      <div class="bottom-sheet__handle" aria-hidden="true"></div>
      <div class="bottom-sheet__head">
        <div>
          <p class="eyebrow">${escapeHtml(cell.brand)} · ${escapeHtml(groupLabel(cell.row.group))}</p>
          <h2 id="mapSheetTitle">${escapeHtml(cell.brand)} · ${escapeHtml(cell.row.label)}</h2>
          <p>${escapeHtml(selectedHistoryPeriod()?.label || "")} ${escapeHtml(changeOptionLabel(state.change))} 기준 제품 ${countText}가 있습니다.</p>
        </div>
        <button class="sheet-close" type="button" data-sheet-close aria-label="바텀시트 닫기">×</button>
      </div>
      <div class="sheet-product-list">
        ${cell.shoes.map(sheetProductMarkup).join("")}
      </div>
      <div class="sheet-actions">
        <button
          class="primary-link"
          type="button"
          data-sheet-action="details"
          data-brand="${escapeHtml(cell.brand)}"
          data-category="${escapeHtml(cell.category)}"
        >
          이 구역 자세히 보기
        </button>
        <button class="back-link" type="button" data-sheet-action="compare">비교 담기</button>
      </div>
      <p id="sheetStatus" class="sheet-status" role="status" aria-live="polite"></p>
    `;
  }

  function openMapSheet(brand, category) {
    const items = getMapFilteredShoes();
    const row = getMapVisibleRows().find((item) => item.category === category);
    const shoesInCell = items.filter((shoe) => shoe.brand === brand && shoe.category === category);
    if (!row || !shoesInCell.length) return;

    state.selectedCell = { brand, category };
    state.lastFocus = document.activeElement;
    renderMapSheet({
      brand,
      category,
      row,
      shoes: shoesInCell,
    });
    el.mapSheetBackdrop.hidden = false;
    el.mapSheet.hidden = false;
    document.body.classList.add("sheet-open");
    el.mapSheet.querySelector("[data-sheet-close]")?.focus();
  }

  function closeMapSheet(restoreFocus = true) {
    el.mapSheetBackdrop.hidden = true;
    el.mapSheet.hidden = true;
    document.body.classList.remove("sheet-open");
    state.selectedCell = null;
    if (restoreFocus && state.lastFocus && typeof state.lastFocus.focus === "function") {
      state.lastFocus.focus();
    }
  }

  function showCellDetails(brand, category) {
    state.brand = brand;
    state.category = category;
    state.group = categoryGroupMap[category] || "전체";
    state.query = "";
    state.tags.clear();
    const brandIndex = pickerBrandOptions.indexOf(brand);
    const categoryIndex = pickerCategoryOptions.indexOf(category);
    state.pickerBrandIndex = brandIndex >= 0 ? brandIndex : 0;
    state.pickerCategoryIndex = categoryIndex >= 0 ? categoryIndex : 0;
    el.searchInput.value = "";
    el.sortSelect.value = state.sort;
    closeMapSheet(false);
    window.location.hash = "#/";
    if (state.route === "picker") {
      renderPicker();
    }
  }

  function wireImages() {
    document.querySelectorAll("img[data-shoe-image]").forEach((image) => {
      if (image.dataset.wired) return;
      image.dataset.wired = "true";
      image.addEventListener("load", () => {
        const box = image.closest(".shoe-image");
        if (box) {
          box.classList.remove("is-failed");
          box.classList.add("is-loaded");
        }
      });
      image.addEventListener("error", () => {
        const box = image.closest(".shoe-image");
        if (box) {
          box.classList.remove("is-loaded");
          box.classList.add("is-failed");
        }
      });
      if (image.complete && image.naturalWidth > 0) {
        const box = image.closest(".shoe-image");
        if (box) {
          box.classList.remove("is-failed");
          box.classList.add("is-loaded");
        }
      } else if (image.complete) {
        const box = image.closest(".shoe-image");
        if (box) {
          box.classList.remove("is-loaded");
          box.classList.add("is-failed");
        }
      }
    });
  }

  function syncRoute() {
    const hash = decodeURIComponent(window.location.hash || "#/");
    const match = hash.match(/^#\/shoe\/(.+)$/);
    state.detailId = match ? match[1] : "";
    renderPeriodArchive();

    if (state.detailId) {
      setRoute("detail");
      const shoe = shoes.find((item) => item.id === state.detailId);
      closeMapSheet(false);
      clearPickerTimers();
      setHidden(el.periodArchive, true);
      setHidden(el.globalViewNav, true);
      setHidden(el.filterPanel, true);
      setHidden(el.homeView, true);
      setHidden(el.overviewView, true);
      setHidden(el.pickerView, true);
      setHidden(el.detailView, false);
      updateViewLinks();
      if (shoe) {
        renderDetail(shoe);
      } else {
        el.detailView.innerHTML = `
          <a class="back-link" href="${escapeHtml(state.lastBrowseRoute || "#/")}">← 집중 보기</a>
          <section class="empty-state">
            <h2>상세 정보를 찾을 수 없습니다</h2>
            <p>라인업으로 돌아가 다시 선택해 주세요.</p>
          </section>
        `;
      }
      window.scrollTo(0, 0);
      return;
    }

    if (hash === "#/overview") {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/`);
      syncRoute();
      return;
    }

    if (hash === "#/list" || hash === "#/home") {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/`);
      syncRoute();
      return;
    }

    if (hash === "#/" || hash === "" || hash === "#/picker") {
      setRoute("picker");
      state.lastBrowseRoute = "#/";
      closeMapSheet(false);
      setHidden(el.periodArchive, true);
      setHidden(el.globalViewNav, true);
      setHidden(el.filterPanel, true);
      setHidden(el.homeView, true);
      setHidden(el.overviewView, true);
      setHidden(el.pickerView, false);
      setHidden(el.detailView, true);
      renderPicker();
      window.scrollTo(0, 0);
      return;
    }

    setRoute("picker");
    state.lastBrowseRoute = "#/";
    closeMapSheet(false);
    clearPickerTimers();
    setHidden(el.periodArchive, true);
    setHidden(el.globalViewNav, true);
    setHidden(el.filterPanel, true);
    setHidden(el.homeView, true);
    setHidden(el.overviewView, true);
    setHidden(el.pickerView, false);
    setHidden(el.detailView, true);
    renderPicker();
  }

  el.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCurrentRoute();
  });

  el.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderCurrentRoute();
  });

  el.resetButton.addEventListener("click", () => {
    state.query = "";
    state.brand = "전체";
    state.group = "전체";
    state.category = "전체";
    state.periodId = activeHistoryPeriod?.id || state.periodId;
    state.change = "전체";
    state.tags.clear();
    state.sort = "table";
    el.searchInput.value = "";
    el.sortSelect.value = "table";
    renderPeriodArchive();
    renderCurrentRoute();
  });

  el.periodArchive.addEventListener("click", (event) => {
    const button = event.target.closest("[data-period-id]");
    if (!button) return;
    state.periodId = button.dataset.periodId;
    state.change = "전체";
    state.tags.clear();
    if (el.searchInput) el.searchInput.value = state.query;
    renderPeriodArchive();
    renderCurrentRoute();
  });

  el.pickerPeriodTrigger.addEventListener("click", () => {
    setPickerFilterPanel("period");
  });

  el.pickerCategoryTrigger.addEventListener("click", () => {
    setPickerFilterPanel("category");
  });

  el.pickerPeriodPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-picker-period-id]");
    if (!button) return;
    selectPickerPeriod(button.dataset.pickerPeriodId);
  });

  el.pickerCategoryPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-picker-category-index]");
    if (!button) return;
    selectPickerAxis("category", Number(button.dataset.pickerCategoryIndex));
  });

  el.mapSearchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderOverview();
  });

  el.zoomOutButton.addEventListener("click", () => {
    changeMapZoom(state.mapZoom - 0.15);
  });

  el.zoomResetButton.addEventListener("click", () => {
    changeMapZoom(1);
  });

  el.zoomInButton.addEventListener("click", () => {
    changeMapZoom(state.mapZoom + 0.15);
  });

  el.mapViewport.addEventListener("scroll", scheduleMiniMapUpdate, { passive: true });

  [el.pickerBrandAxis, el.pickerCategoryAxis].forEach((container) => {
    container.addEventListener("click", (event) => {
      const item = event.target.closest("[data-axis]");
      if (!item) return;
      selectPickerAxis(item.dataset.axis, Number(item.dataset.logicalIndex));
    });
  });

  el.pickerView.addEventListener("keydown", (event) => {
    if (state.route !== "picker") return;
    if (event.key === "Escape" && state.pickerFilterPanel) {
      event.preventDefault();
      closePickerFilterPanels();
      return;
    }
    const brandAxisFocused = Boolean(event.target.closest("#pickerBrandAxis"));
    const categoryAxisFocused = Boolean(event.target.closest("#pickerCategoryAxis"));
    const focusedAxis = brandAxisFocused ? "brand" : categoryAxisFocused ? "category" : "";
    if (event.key === "ArrowLeft") {
      if (!focusedAxis) return;
      event.preventDefault();
      selectPickerAxis(focusedAxis, pickerAxisIndex(focusedAxis) - 1);
    }
    if (event.key === "ArrowRight") {
      if (!focusedAxis) return;
      event.preventDefault();
      selectPickerAxis(focusedAxis, pickerAxisIndex(focusedAxis) + 1);
    }
    if (event.key === "ArrowUp") {
      if (!brandAxisFocused) return;
      event.preventDefault();
      const target = el.pickerCategoryAxis.querySelector(`[data-axis="category"][data-logical-index="${state.pickerCategoryIndex}"]`);
      target?.focus();
    }
    if (event.key === "ArrowDown") {
      if (!categoryAxisFocused) return;
      event.preventDefault();
      const target = el.pickerBrandAxis.querySelector(`[data-axis="brand"][data-logical-index="${state.pickerBrandIndex}"]`);
      target?.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (state.route !== "picker" || !state.pickerFilterPanel) return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const insidePickerFilter = path.some((node) => node?.classList?.contains("picker-filter-dock") || node?.classList?.contains("picker-filter-panel"));
    if (insidePickerFilter || event.target.closest(".picker-filter-dock") || event.target.closest(".picker-filter-panel")) return;
    closePickerFilterPanels();
  });

  el.shoeMapCanvas.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-map-cell]");
    if (!cell || cell.disabled) return;
    openMapSheet(cell.dataset.brand, cell.dataset.category);
  });

  el.mapSheetBackdrop.addEventListener("click", () => {
    closeMapSheet();
  });

  el.mapSheet.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-sheet-close]");
    if (closeButton) {
      closeMapSheet();
      return;
    }

    const productLink = event.target.closest(".sheet-product");
    if (productLink) {
      closeMapSheet(false);
      return;
    }

    const action = event.target.closest("[data-sheet-action]");
    if (!action) return;

    if (action.dataset.sheetAction === "details") {
      showCellDetails(action.dataset.brand, action.dataset.category);
      return;
    }

    if (action.dataset.sheetAction === "compare") {
      const status = el.mapSheet.querySelector("#sheetStatus");
      if (status) {
        status.textContent = "비교 담기는 다음 단계에서 연결됩니다.";
      }
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.mapSheet.hidden) {
      closeMapSheet();
    }
  });

  window.addEventListener("hashchange", syncRoute);
  syncRoute();
})();
