(function () {
  const shoes = window.RUNNING_SHOES || [];
  const periods = window.RUNNING_LINEUP_PERIODS || [];
  const lineupHistory = window.RUNNING_LINEUP_HISTORY || { periods: [], entries: [] };
  const priceSnapshot = window.RUNNING_PRICE_SNAPSHOT || { generatedAt: "", source: "pending", currency: "KRW", items: {} };
  const priceQueryConfig = window.RUNNING_PRICE_QUERY_CONFIG || {};

  const brandOrder = ["Nike", "Adidas", "ASICS", "New Balance", "Saucony", "Puma", "HOKA", "Brooks", "Mizuno", "On"];
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
    route: "home",
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
    listLink: document.querySelector("#listLink"),
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
    pickerCoordinate: document.querySelector("#pickerCoordinate"),
    pickerSummary: document.querySelector("#pickerSummary"),
    pickerBrandAxis: document.querySelector("#pickerBrandAxis"),
    pickerCategoryAxis: document.querySelector("#pickerCategoryAxis"),
    pickerDetail: document.querySelector("#pickerDetail"),
  };

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

  function historyPanelMarkup(shoe) {
    const history = historyTimelineFor(shoe);
    if (!history.timeline.length) return "";

    const firstLabel = history.firstPeriod?.label || "이전 분기 미확인";
    const headline = history.count
      ? history.isNew
        ? `${activeHistoryPeriod?.label || "현재"} 첫 등장 라인`
        : `${firstLabel}부터 ${history.count}개 분기 등장`
      : "분기 이력 미확인";
    const streakLabel = history.streak >= 2 ? `${history.streak}분기 연속` : history.count ? "간헐 등장" : "등장 없음";

    return `
      <section class="history-panel" aria-label="분기별 라인 이력">
        <div class="history-panel__head">
          <div>
            <p class="eyebrow">LINEUP HISTORY</p>
            <h3>분기별 라인 이력</h3>
          </div>
          ${historyBadgeMarkup(shoe)}
        </div>
        <p class="history-panel__lead">
          같은 브랜드·종류 셀 기준의 반복 등장 흐름입니다.
        </p>
        <div class="history-stats" aria-label="라인 이력 요약">
          <span>
            <strong>${escapeHtml(String(history.count))}</strong>
            <small>등장 분기</small>
          </span>
          <span>
            <strong>${escapeHtml(streakLabel)}</strong>
            <small>최근 흐름</small>
          </span>
          <span>
            <strong>${escapeHtml(headline)}</strong>
            <small>요약</small>
          </span>
        </div>
        <ol class="history-timeline">
          ${history.timeline
            .map(
              ({ period, models, matched }) => `
                <li class="history-period ${matched ? "is-matched" : ""}">
                  <span class="history-period__date">${escapeHtml(period.label || period.id)}</span>
                  <span class="history-period__status">${matched ? "라인 등장" : models.length ? "같은 셀 기록" : "기록 없음"}</span>
                  <span class="history-period__models">${historyModelsMarkup(models)}</span>
                </li>
              `
            )
            .join("")}
        </ol>
        <p class="history-panel__note">
          2024.08~2026.02는 원문표 이미지 OCR 구조화, 2026.05는 앱 구조화 데이터 기준입니다.
        </p>
      </section>
    `;
  }

  function selectedHistoryPeriod() {
    return historyPeriods.find((period) => period.id === state.periodId) || activeHistoryPeriod || historyPeriods[historyPeriods.length - 1] || null;
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
    return (
      sameCell.find((shoe) => normalizeHistoryText(shoe.model) === exactModel || normalizeHistoryText(shoe.displayName) === exactModel) ||
      sameCell.find((shoe) => [lineKey(shoe.model), lineKey(shoe.displayName)].some((key) => lineKeyMatches(key, lineKey(model)))) ||
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
    const period = selectedHistoryPeriod();
    if (!period) return [];
    if (state.change === "dropped") return droppedLineupItems(period.id);
    return periodLineupItems(period.id).filter(matchesChangeFilter);
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
    const query = normalize(state.query);

    return baseLineupItemsForSelectedPeriod()
      .filter((shoe) => {
        const haystack = normalize([shoe.brand, shoe.model, shoe.displayName, shoe.categoryGroup, shoe.category].join(" "));
        const matchesQuery = !query || haystack.includes(query);
        const matchesBrand = state.brand === "전체" || shoe.brand === state.brand;
        const matchesGroup = state.group === "전체" || shoe.categoryGroup === state.group;
        return matchesQuery && matchesBrand && matchesGroup;
      })
      .sort((a, b) => a.tableOrder - b.tableOrder);
  }

  function getMapVisibleBrands() {
    return state.brand === "전체" ? brandOrder : brandOrder.filter((brand) => brand === state.brand);
  }

  function getMapVisibleRows() {
    return categoryOrder
      .map((category) => ({
        category,
        group: categoryGroupMap[category],
        label: mapCategoryLabels[category] || category,
      }))
      .filter((row) => state.group === "전체" || row.group === state.group);
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

  function priceInfoFor(shoe) {
    return priceSnapshot.items?.[shoe.id] || (shoe.detailId ? priceSnapshot.items?.[shoe.detailId] : null) || null;
  }

  function hasPriceSnapshot() {
    return Boolean(priceSnapshot.generatedAt && priceSnapshot.source !== "pending");
  }

  function formatWon(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return "-";
    return `₩${amount.toLocaleString("ko-KR")}`;
  }

  function formatSnapshotDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function priceConfidenceLabel(confidence) {
    return (
      {
        high: "자동 매칭",
        medium: "확인 권장",
        low: "수동 확인",
      }[confidence] || "수동 확인"
    );
  }

  function shoppingSearchQuery(shoe) {
    const override = priceQueryConfig.overrides?.[shoe.id] || {};
    if (override.query) return override.query;
    const brand = override.brand || priceQueryConfig.brandQueryNames?.[shoe.brand] || shoe.brand;
    const suffix = override.suffix ?? priceQueryConfig.defaultSuffix ?? "러닝화";
    return [brand, override.model || shoe.model, suffix].filter(Boolean).join(" ");
  }

  function shoppingSearchUrl(shoe) {
    return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(shoppingSearchQuery(shoe))}`;
  }

  function priceOfferLinkFor(shoe) {
    const info = priceInfoFor(shoe);
    return info?.status === "found" ? info.lowestOffer?.link || shoppingSearchUrl(shoe) : "";
  }

  function pickerPriceActionMarkup(shoe) {
    const info = priceInfoFor(shoe);
    const searchUrl = shoppingSearchUrl(shoe);

    if (info?.status === "found") {
      const link = priceOfferLinkFor(shoe) || searchUrl;
      const mallName = info.lowestOffer?.mallName || "쇼핑몰";
      return `
        <a class="picker-shop-link picker-shop-link--price" href="${escapeHtml(link)}" target="_blank" rel="noreferrer">
          <span>최저가 후보</span>
          <strong>${formatWon(info.lowestPrice)}</strong>
          <small>${escapeHtml(mallName)}</small>
        </a>
      `;
    }

    return `
      <a class="picker-shop-link" href="${escapeHtml(searchUrl)}" target="_blank" rel="noreferrer">
        <span>가격 검색</span>
        <strong>네이버 쇼핑</strong>
        <small>${hasPriceSnapshot() ? "직접 확인" : "스냅샷 준비 중"}</small>
      </a>
    `;
  }

  function priceBadgeMarkup(shoe, showPending = true, mode = "span") {
    const info = priceInfoFor(shoe);
    if (info?.status === "found") {
      const label = `최저가 후보 ${formatWon(info.lowestPrice)}`;
      const link = priceOfferLinkFor(shoe);
      const ariaLabel = `${shoe.brand} ${shoe.model} ${label} 쇼핑몰 열기`;
      if (mode === "anchor") {
        return `<a class="price-pill price-pill--ready price-pill--link" href="${escapeHtml(link)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(ariaLabel)}">${label}</a>`;
      }
      if (mode === "inlineLink") {
        return `<span class="price-pill price-pill--ready price-pill--link" role="link" tabindex="0" data-price-link="${escapeHtml(link)}" aria-label="${escapeHtml(ariaLabel)}">${label}</span>`;
      }
      return `<span class="price-pill price-pill--ready">${label}</span>`;
    }
    if (!showPending) {
      return "";
    }
    if (!hasPriceSnapshot()) {
      return `<span class="price-pill price-pill--pending">가격 준비 중</span>`;
    }
    if (info?.status === "error") {
      return `<span class="price-pill price-pill--pending">조회 실패</span>`;
    }
    return `<span class="price-pill price-pill--pending">가격 확인 필요</span>`;
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
                    : `${cell.brand} ${row.label} ${cell.count}개: ${cell.productNames}. 제품 목록 보기`;
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
                          ${cell.count ? escapeHtml(cell.count === 1 ? row.label : "눌러서 목록 보기") : "제품 없음"}
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
        const status = period.active ? `${stats?.models || shoes.length}개 현재` : `${stats?.models || 0}개 OCR`;
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
          <a class="period-source" href="${escapeHtml(active.sourcePostUrl)}" target="_blank" rel="noreferrer">선택 원문</a>
        </div>
      </div>
      <div class="period-archive__meta" aria-label="분기 구조화 요약">
        <span>${historyPeriods.length}개 분기</span>
        <span>총 ${historyTotalModelCount}개 모델 후보</span>
        <span>${active.structured ? "앱 구조화" : "OCR 구조화"}</span>
      </div>
      <div class="period-archive__rail" aria-label="분기 선택">
        ${sourceLinks}
      </div>
    `;
  }

  function titleForActiveFilters() {
    const titleParts = [state.brand, state.group, state.category].filter((value) => value !== "전체");
    const periodLabel = selectedHistoryPeriod()?.label || "";
    const changeLabel = state.change === "전체" ? "" : changeOptionLabel(state.change);
    const baseTitle = titleParts.length ? titleParts.join(" · ") : "라인업 전체";
    return [periodLabel, changeLabel, baseTitle].filter(Boolean).join(" · ");
  }

  function updateViewLinks() {
    el.listLink.classList.toggle("is-active", state.route === "home");
    el.overviewLink.classList.toggle("is-active", state.route === "overview");
    el.pickerLink.classList.toggle("is-active", state.route === "picker");
  }

  function setRoute(route) {
    state.route = route;
    document.body.dataset.route = route;
  }

  function renderCurrentRoute() {
    if (state.route === "overview") {
      renderOverview();
      return;
    }
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
    return mapCategoryLabels[category] || category;
  }

  function pickerAxisCategoryLabel(category) {
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

  function selectedPickerBrand() {
    return brandOrder[state.pickerBrandIndex] || brandOrder[0];
  }

  function selectedPickerCategory() {
    return categoryOrder[state.pickerCategoryIndex] || categoryOrder[0];
  }

  function pickerProducts() {
    const brand = selectedPickerBrand();
    const category = selectedPickerCategory();
    return baseLineupItemsForSelectedPeriod().filter((shoe) => shoe.brand === brand && shoe.category === category);
  }

  function pickerAxisItems(values, axis) {
    return values
      .map((value, logicalIndex) => {
        const label = axis === "category" ? pickerAxisCategoryLabel(value) : value;
        const ariaLabel = axis === "category" ? pickerCategoryLabel(value) : value;
        const visual = axis === "brand" ? brandLogoMarkup(value) : escapeHtml(label);
        const groupStartClass = axis === "category" && isGroupStartCategory(value) ? " picker-axis-item--group-start" : "";
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
    el.pickerBrandAxis.innerHTML = pickerAxisItems(brandOrder, "brand");
    el.pickerCategoryAxis.innerHTML = pickerAxisItems(categoryOrder, "category");
    state.pickerAxesReady = true;
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
    return axis === "brand" ? brandOrder.length : categoryOrder.length;
  }

  function revealPickerAxisItem(axis, index, behavior = "smooth") {
    const container = pickerAxisContainer(axis);
    const target = container.querySelector(`[data-axis="${axis}"][data-logical-index="${index}"]`);
    if (!target) return;

    if (axis === "brand") {
      target.scrollIntoView({ behavior, block: "nearest", inline: "center" });
    }
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
  }

  function renderPickerDetail() {
    const brand = selectedPickerBrand();
    const category = selectedPickerCategory();
    const products = pickerProducts();
    const categoryGroup = categoryGroupMap[category] || "";
    const coordinate = `${brand} × ${pickerCategoryLabel(category)}`;
    const periodLabel = selectedHistoryPeriod()?.label || "";
    const countText = products.length ? `${products.length}개 제품` : "라인업 없음";
    el.pickerCoordinate.textContent = coordinate;
    if (el.pickerSummary) {
      el.pickerSummary.textContent = [periodLabel, countText].filter(Boolean).join(" · ");
    }
    el.pickerDetail.className = `picker-detail-card picker-detail-card--${products.length ? "filled" : "empty"}`;

    el.pickerDetail.innerHTML = `
      <div class="picker-stage" aria-label="${escapeHtml(coordinate)}">
        <div class="picker-stage__identity">
          ${brandLogoMarkup(brand)}
          <span class="visually-hidden">${escapeHtml(brand)}</span>
          <span class="picker-stage__copy">
            <span>${escapeHtml(categoryGroup || "라인업")}</span>
            <strong>${escapeHtml(pickerCategoryLabel(category))}</strong>
          </span>
        </div>
        <div class="picker-stage__stats" aria-label="${escapeHtml(`${periodLabel} ${countText}`)}">
          <span>${escapeHtml(periodLabel)}</span>
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
      ? `<a class="picker-detail-link" href="${escapeHtml(href)}" aria-label="${escapeHtml(`${shoe.brand} ${shoe.model} 상세 보기`)}">상세 보기</a>`
      : "";

    return `
      <article class="picker-product-card ${href ? "" : "picker-product-card--static"}">
        <div class="picker-product-card__media">
          ${imageMarkup(shoe, "picker")}
        </div>
        <div class="picker-product-card__body">
          <span class="picker-product-card__meta">
            <span>${escapeHtml(shoe.periodLabel || selectedHistoryPeriod()?.label || "")}</span>
            ${changeBadgeMarkup(shoe, true)}
          </span>
          <strong class="picker-product-card__name">${escapeHtml(shoe.displayName || shoe.model)}</strong>
          <span class="picker-product-card__sub">${escapeHtml(shoe.categoryGroup)} · ${escapeHtml(shoe.category)}</span>
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
    updatePickerAxisState(axis);
    renderPickerDetail();
    revealPickerAxisItem(axis, nextIndex, behavior);
  }

  function renderPicker() {
    renderPickerAxes();
    updateViewLinks();
    updatePickerAxisState("brand");
    updatePickerAxisState("category");
    renderPickerDetail();
  }

  function clearPickerTimers() {
    return;
  }

  function pricePanelMarkup(shoe) {
    const info = priceInfoFor(shoe);
    const generatedLabel = formatSnapshotDate(info?.fetchedAt || priceSnapshot.generatedAt);
    const searchUrl = shoppingSearchUrl(shoe);

    if (info?.status === "found") {
      const offers = info.offers || [];
      return `
        <section class="price-panel" aria-label="가격 후보">
          <div class="price-panel__head">
            <div>
              <p class="eyebrow">PRICE</p>
              <h3>가격 후보</h3>
            </div>
            <span class="price-pill price-pill--ready">${priceConfidenceLabel(info.confidence)}</span>
          </div>
          <a class="price-panel__lowest" href="${escapeHtml(info.lowestOffer?.link || searchUrl)}" target="_blank" rel="noreferrer">
            <span>
              <span class="price-panel__label">최저가 후보</span>
              <strong>${formatWon(info.lowestPrice)}</strong>
            </span>
            <span class="price-panel__mall">${escapeHtml(info.lowestOffer?.mallName || "네이버 쇼핑")}</span>
          </a>
          <div class="price-panel__meta">
            <span>${generatedLabel ? `${escapeHtml(generatedLabel)} 기준` : "최근 스냅샷 기준"}</span>
            <span>사이즈, 배송비, 재고는 쇼핑몰에서 확인 필요</span>
            <a href="${escapeHtml(searchUrl)}" target="_blank" rel="noreferrer">네이버 쇼핑 검색</a>
          </div>
          <div class="price-offer-list" aria-label="가격 후보">
            ${offers.map(priceOfferMarkup).join("")}
          </div>
        </section>
      `;
    }

    const message = !hasPriceSnapshot()
      ? "아직 가격 스냅샷이 없습니다. API 키가 연결되면 GitHub Actions가 자동으로 가격 후보를 채웁니다."
      : info?.message || "조건에 맞는 자동 매칭 결과가 없습니다. 검색 결과를 직접 확인해 주세요.";

    return `
      <section class="price-panel price-panel--pending" aria-label="가격 후보">
        <div class="price-panel__head">
          <div>
            <p class="eyebrow">PRICE</p>
            <h3>가격 후보</h3>
          </div>
          ${priceBadgeMarkup(shoe)}
        </div>
        <p>${escapeHtml(message)}</p>
        <a class="primary-link" href="${escapeHtml(searchUrl)}" target="_blank" rel="noreferrer">네이버 쇼핑에서 직접 보기</a>
      </section>
    `;
  }

  function priceOfferMarkup(offer) {
    return `
      <a class="price-offer" href="${escapeHtml(offer.link)}" target="_blank" rel="noreferrer">
        <span class="price-offer__title">${escapeHtml(offer.title)}</span>
        <span class="price-offer__meta">
          <span>${escapeHtml(offer.mallName || "판매처")}</span>
          <strong>${formatWon(offer.price)}</strong>
        </span>
      </a>
    `;
  }

  function renderDetail(shoe) {
    const backHref = state.lastBrowseRoute || "#/";
    const backLabel = backHref === "#/overview" ? "맵 보기" : backHref === "#/list" ? "리스트" : "집중 보기";

    el.detailView.innerHTML = `
      <a class="back-link" href="${escapeHtml(backHref)}">← ${backLabel}</a>
      <article class="detail-card">
        <div class="detail-card__media">
          ${imageMarkup(shoe, "detail")}
        </div>
        <div class="detail-card__content">
          <div class="detail-brand-line">
            ${brandLogoMarkup(shoe.brand)}
            <span>2026.05 구조화</span>
          </div>
          <h2>${escapeHtml(shoe.displayName || shoe.model)}</h2>
          ${
            shoe.displayName && shoe.displayName !== shoe.model
              ? `<p class="detail-card__subtitle">${escapeHtml(shoe.model)}</p>`
              : ""
          }
          <div class="detail-meta">
            <span>${escapeHtml(shoe.categoryGroup)}</span>
            <span>${escapeHtml(shoe.category)}</span>
            ${dropMarkup(shoe)}
          </div>
          <div class="tag-list">${tagMarkup(shoe.tags)}</div>
          <div class="detail-actions">
            <a class="primary-link" href="${escapeHtml(shoe.officialProductUrl || shoe.imageSourceUrl)}" target="_blank" rel="noreferrer">
              공식 출처 보기
            </a>
            ${priceBadgeMarkup(shoe, true, "anchor")}
          </div>
        </div>
      </article>
      ${historyPanelMarkup(shoe)}
      ${pricePanelMarkup(shoe)}
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
    el.searchInput.value = "";
    el.sortSelect.value = state.sort;
    closeMapSheet(false);
    window.location.hash = "#/list";
    renderHome();
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
      el.periodArchive.hidden = true;
      el.globalViewNav.hidden = true;
      el.filterPanel.hidden = true;
      el.homeView.hidden = true;
      el.overviewView.hidden = true;
      el.pickerView.hidden = true;
      el.detailView.hidden = false;
      if (shoe) {
        renderDetail(shoe);
      } else {
        el.detailView.innerHTML = `
          <a class="back-link" href="${escapeHtml(state.lastBrowseRoute || "#/")}">← 집중 보기</a>
          <section class="empty-state">
            <h2>상세 정보를 찾을 수 없습니다</h2>
            <p>추천표로 돌아가 다시 선택해 주세요.</p>
          </section>
        `;
      }
      window.scrollTo(0, 0);
      return;
    }

    if (hash === "#/overview") {
      setRoute("overview");
      state.lastBrowseRoute = "#/overview";
      clearPickerTimers();
      el.periodArchive.hidden = false;
      el.globalViewNav.hidden = false;
      el.filterPanel.hidden = true;
      el.homeView.hidden = true;
      el.overviewView.hidden = false;
      el.pickerView.hidden = true;
      el.detailView.hidden = true;
      renderOverview();
      window.scrollTo(0, 0);
      return;
    }

    if (hash === "#/list") {
      setRoute("home");
      state.lastBrowseRoute = "#/list";
      closeMapSheet(false);
      clearPickerTimers();
      el.periodArchive.hidden = false;
      el.globalViewNav.hidden = false;
      el.filterPanel.hidden = false;
      el.homeView.hidden = false;
      el.overviewView.hidden = true;
      el.pickerView.hidden = true;
      el.detailView.hidden = true;
      renderHome();
      window.scrollTo(0, 0);
      return;
    }

    if (hash === "#/" || hash === "" || hash === "#/picker") {
      setRoute("picker");
      state.lastBrowseRoute = hash === "#/picker" ? "#/picker" : "#/";
      closeMapSheet(false);
      el.periodArchive.hidden = false;
      el.globalViewNav.hidden = false;
      el.filterPanel.hidden = true;
      el.homeView.hidden = true;
      el.overviewView.hidden = true;
      el.pickerView.hidden = false;
      el.detailView.hidden = true;
      renderPicker();
      window.scrollTo(0, 0);
      return;
    }

    setRoute("picker");
    state.lastBrowseRoute = "#/";
    closeMapSheet(false);
    clearPickerTimers();
    el.periodArchive.hidden = false;
    el.globalViewNav.hidden = false;
    el.filterPanel.hidden = true;
    el.homeView.hidden = true;
    el.overviewView.hidden = true;
    el.pickerView.hidden = false;
    el.detailView.hidden = true;
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

  function openExternalPriceLink(link) {
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  el.shoeGrid.addEventListener("click", (event) => {
    const priceLink = event.target.closest("[data-price-link]");
    if (!priceLink) return;
    event.preventDefault();
    event.stopPropagation();
    openExternalPriceLink(priceLink.dataset.priceLink);
  });

  el.shoeGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const priceLink = event.target.closest("[data-price-link]");
    if (!priceLink) return;
    event.preventDefault();
    event.stopPropagation();
    openExternalPriceLink(priceLink.dataset.priceLink);
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
    const brandAxisFocused = Boolean(event.target.closest("#pickerBrandAxis"));
    const categoryAxisFocused = Boolean(event.target.closest("#pickerCategoryAxis"));
    if (event.key === "ArrowLeft") {
      if (!brandAxisFocused) return;
      event.preventDefault();
      selectPickerAxis("brand", state.pickerBrandIndex - 1);
    }
    if (event.key === "ArrowRight") {
      if (!brandAxisFocused) return;
      event.preventDefault();
      selectPickerAxis("brand", state.pickerBrandIndex + 1);
    }
    if (event.key === "ArrowUp") {
      if (!categoryAxisFocused) return;
      event.preventDefault();
      selectPickerAxis("category", state.pickerCategoryIndex - 1);
    }
    if (event.key === "ArrowDown") {
      if (!categoryAxisFocused) return;
      event.preventDefault();
      selectPickerAxis("category", state.pickerCategoryIndex + 1);
    }
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
