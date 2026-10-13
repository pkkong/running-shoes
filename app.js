(function () {
  function startRunningApp() {
    const shoes = window.RUNNING_SHOES || [];
    const periods = window.RUNNING_LINEUP_PERIODS || [];
    const lineupHistory = window.RUNNING_LINEUP_HISTORY || { periods: [], entries: [] };
    const priceQueryConfig = window.RUNNING_PRICE_QUERY_CONFIG || {};
    const identity = window.RUNNING_MODEL_IDENTITY;
    const content = window.RUNNING_SHOE_CONTENT;
    const routes = window.RUNNING_SHOE_ROUTES;
    const assetPrefix = location.protocol === "file:" ? "" : "/";

    const ALL_PERIOD_ID = "__all_periods__";
    const ALL_BRAND_VALUE = "전체";
    const brandOrder = ["Nike", "Adidas", "ASICS", "New Balance", "Saucony", "Puma", "HOKA", "Brooks", "Mizuno", "On"];
    const pickerBrandOptions = [ALL_BRAND_VALUE, ...brandOrder];
    const brandSearchAliases = { Nike: "나이키", Adidas: "아디다스", ASICS: "아식스", "New Balance": "뉴발란스", Saucony: "서코니 써코니", Puma: "푸마 퓨마", HOKA: "호카", Brooks: "브룩스", Mizuno: "미즈노", On: "온" };
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
      periodId: "",
      pickerBrandIndex: 0,
      pickerCategoryIndex: 0,
      pickerAxesReady: false,
      pickerFilterPanel: "",
      route: "picker",
      detailId: "",
      lastBrowseRoute: "/",
    };

    const el = {
      pickerView: document.querySelector("#pickerView"),
      detailView: document.querySelector("#detailView"),
      pickerPeriodTrigger: document.querySelector("#pickerPeriodTrigger"),
      pickerCategoryTrigger: document.querySelector("#pickerCategoryTrigger"),
      pickerPeriodPanel: document.querySelector("#pickerPeriodPanel"),
      pickerCategoryPanel: document.querySelector("#pickerCategoryPanel"),
      pickerBrandAxis: document.querySelector("#pickerBrandAxis"),
      pickerDetail: document.querySelector("#pickerDetail"),
      pickerSearchInput: document.querySelector("#pickerSearchInput"),
      pickerSearchClear: document.querySelector("#pickerSearchClear"),
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

    const modelIndex = identity.createIndex(shoes, lineupHistory.periods || periods, historyEntries);
    const historyStatsByPeriod = historyEntries.reduce((acc, entry) => {
      const stats = acc.get(entry.periodId) || { cells: 0, models: 0 };
      if (entry.models.length) stats.cells += 1;
      stats.models += entry.models.length;
      acc.set(entry.periodId, stats);
      return acc;
    }, new Map());
    const activeHistoryPeriod = historyPeriods.find((period) => period.active) || historyPeriods[historyPeriods.length - 1] || null;

    const modelNameCollator = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });
    let allPeriodLineupCache = null;
    state.periodId = activeHistoryPeriod?.id || historyPeriods[historyPeriods.length - 1]?.id || "";

    const browseSnapshots = new Map();
    const browseStorageKey = "running-lineup-browse-v1";
    let navigationRevision = 0;
    let searchFrame = 0;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    function pickerParams() {
      return new URLSearchParams({
        period: state.periodId,
        brand: selectedPickerBrand(),
        category: selectedPickerCategory(),
        ...(state.query.trim() ? { q: state.query.trim() } : {}),
      });
    }

    function pickerBrowseHref() {
      return `${location.protocol === "file:" ? "#/" : "/"}?${pickerParams()}`;
    }

    function applyPickerParams(params) {
      const period = params.get("period");
      state.periodId = period === ALL_PERIOD_ID || historyPeriods.some((item) => item.id === period)
        ? period : activeHistoryPeriod?.id || historyPeriods[historyPeriods.length - 1]?.id || "";
      state.pickerBrandIndex = Math.max(0, pickerBrandOptions.indexOf(params.get("brand")));
      state.pickerCategoryIndex = Math.max(0, pickerCategoryOptions.indexOf(params.get("category")));
      state.query = (params.get("q") || "").slice(0, 200);
      state.pickerFilterPanel = "";
      el.pickerSearchInput.value = state.query;
      el.pickerSearchClear.hidden = !state.query;
      state.lastBrowseRoute = pickerBrowseHref();
    }

    function updatePickerUrl() {
      state.lastBrowseRoute = pickerBrowseHref();
      history.replaceState(null, "", state.lastBrowseRoute);
    }

    function saveBrowsePosition(shoeId = "") {
      if (state.route !== "picker") return;
      const href = pickerBrowseHref();
      const snapshot = {
        href, y: window.scrollY, brandScroll: el.pickerBrandAxis.scrollLeft,
        shoeId: shoeId || browseSnapshots.get(href)?.shoeId || "",
      };
      browseSnapshots.set(href, snapshot);
      history.replaceState({ browse: snapshot }, "", href);
      // Session storage preserves the return position when a detail page is refreshed.
      try { sessionStorage.setItem(browseStorageKey, JSON.stringify(snapshot)); } catch {}
    }

    function restoreBrowsePosition(href, revision) {
      let snapshot = history.state?.browse;
      if (snapshot?.href !== href) snapshot = browseSnapshots.get(href);
      if (!snapshot) {
        try {
          const saved = JSON.parse(sessionStorage.getItem(browseStorageKey));
          if (saved?.href === href) snapshot = saved;
        } catch {}
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (revision !== navigationRevision || state.route !== "picker") return;
        if (snapshot && Number.isFinite(snapshot.brandScroll)) {
          el.pickerBrandAxis.scrollLeft = snapshot.brandScroll;
        } else {
          revealPickerAxisItem("brand", state.pickerBrandIndex, "instant");
        }
        const card = snapshot?.shoeId
          ? [...el.pickerDetail.querySelectorAll("a[data-shoe-id]")].find((item) => item.dataset.shoeId === snapshot.shoeId)
          : null;
        card?.focus({ preventScroll: true });
        window.scrollTo({ top: Number.isFinite(snapshot?.y) ? snapshot.y : 0, behavior: "instant" });
      }));
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

    function historyTimelineFor(shoe, scope = "model") {
      return modelIndex.timelineFor(shoe, { scope, throughPeriodId: shoe.isAllPeriodItem ? "" : shoe.periodId || "" });
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

    function isLineupModelValue(model) {
      const value = String(model || "").trim();
      return Boolean(value) && !/(런갤|런리핏|Great|이상|선호|디시인사이드)/i.test(value);
    }

    function findCurrentShoeForHistory(brand, category, model) {
      return modelIndex.findCurrent(brand, model);
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
          const modelKey = identity.familyKey(entry.brand, model);
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

    function baseLineupItemsForSelectedPeriod() {
      if (isAllPeriodsSelected()) {
        return allPeriodLineupItems();
      }
      const period = selectedHistoryPeriod();
      if (!period) return [];
      return periodLineupItems(period.id);
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

    function isGroupStartCategory(category) {
      const index = categoryOrder.indexOf(category);
      if (index <= 0) return false;
      return categoryGroupMap[category] !== categoryGroupMap[categoryOrder[index - 1]];
    }

    function featureBadgesMarkup(shoe) {
      return content.evidence(shoe, historyTimelineFor(shoe), window.RUNNING_RUNREPEAT?.reviewForShoe(shoe));
    }

    function pickerEvidenceMarkup(shoe) {
      return `
        <div class="picker-product-card__evidence" aria-label="${escapeHtml(`${shoe.brand} ${shoe.model} 특징`)}">
          ${featureBadgesMarkup(shoe)}
        </div>
      `;
    }

    function imageMarkup(shoe, variant) {
      return content.image(shoe, variant, assetPrefix);
    }

    function detailHrefForItem(item) {
      const shoe = shoes.find((value) => value.id === (item.detailId || item.id));
      return shoe ? (location.protocol === "file:" ? `#/shoe/${encodeURIComponent(shoe.id)}` : routes.pathFor(shoe)) : "";
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
      state.pickerFilterPanel = "";
      updatePickerUrl();
      renderPicker();
      el.pickerPeriodTrigger.focus({ preventScroll: true });
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

    function pickerCategoryOptionMarkup(option, index) {
      return pickerFilterButtonMarkup({
        active: index === state.pickerCategoryIndex,
        label: pickerAxisCategoryLabel(option),
        subLabel: "",
        value: index,
        attr: "data-picker-category-index",
      });
    }

    function pickerCategoryGroupMarkup(group) {
      const options = categoryOrder.filter((category) => categoryGroupMap[category] === group);
      if (!options.length) return "";

      return `
        <section class="picker-category-group" aria-label="${escapeHtml(group)} 종류">
          <h3>${escapeHtml(group)}</h3>
          <div class="picker-filter-panel__grid picker-filter-panel__grid--category">
            ${options
              .map((option) => pickerCategoryOptionMarkup(option, pickerCategoryOptions.indexOf(option)))
              .join("")}
          </div>
        </section>
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

      const categoryTriggerLabel = category === "전체" ? "전체" : `${categoryGroupMap[category] || ""} · ${pickerCategoryLabel(category)}`;
      el.pickerCategoryTrigger.innerHTML = `
        <span>종류</span>
        <strong>${escapeHtml(categoryTriggerLabel)}</strong>
      `;
      el.pickerCategoryTrigger.classList.toggle("is-open", categoryPanelOpen);
      el.pickerCategoryTrigger.setAttribute("aria-expanded", categoryPanelOpen ? "true" : "false");
      el.pickerCategoryTrigger.setAttribute("aria-label", `${brand} ${categoryTriggerLabel} ${count}개 제품`);

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
          <div class="picker-category-panel">
            <div class="picker-category-panel__all">
              ${pickerCategoryOptionMarkup("전체", 0)}
            </div>
            <div class="picker-category-groups">
              ${groupOrder.map((group) => pickerCategoryGroupMarkup(group)).join("")}
            </div>
          </div>
        `;
      } else {
        el.pickerCategoryPanel.innerHTML = "";
      }
    }

    function setRoute(route) {
      state.route = route;
      document.body.dataset.route = route;
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
      return content.brandLogo(brand, assetPrefix);
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
      const queryTerms = state.query.trim().split(/\s+/).map(normalizeHistoryText).filter(Boolean);
      const products = baseLineupItemsForSelectedPeriod().filter((shoe) => {
        const matchesBrand = brand === ALL_BRAND_VALUE || shoe.brand === brand;
        const matchesCategory = category === "전체" || shoe.category === category;
        const haystack = normalizeHistoryText([shoe.model, shoe.displayName, shoe.brand, brandSearchAliases[shoe.brand]].join(" "));
        return matchesBrand && matchesCategory && queryTerms.every((term) => haystack.includes(term));
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
      state.pickerAxesReady = true;
    }

    function pickerAxisContainer(axis) {
      return axis === "brand" ? el.pickerBrandAxis : null;
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
      if (!container) return;
      const target = container.querySelector(`[data-axis="${axis}"][data-logical-index="${index}"]`);
      if (!target) return;

      target.scrollIntoView({ behavior, block: "nearest", inline: "center" });
    }

    function updatePickerAxisState(axis) {
      const container = pickerAxisContainer(axis);
      if (!container) return;
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
      const brandLabel = pickerBrandLabel(brand);
      const categoryLabel = pickerCategoryLabel(category);
      const coordinate = `${brandLabel} × ${categoryLabel}`;
      const periodLabel = selectedPickerPeriodLabel();
      const countText = products.length ? `${products.length}개 제품` : "라인업 없음";
      el.pickerDetail.className = `picker-detail-card picker-detail-card--${products.length ? "filled" : "empty"}`;

      el.pickerDetail.innerHTML = `
        <div class="picker-stage" aria-label="${escapeHtml(coordinate)}">
          <strong class="picker-stage__title">${escapeHtml(brandLabel)} · ${escapeHtml(categoryLabel)}</strong>
          <div class="picker-stage__stats" aria-label="${escapeHtml(`${periodLabel} ${countText}`)}">
            <span>${escapeHtml(periodLabel)}</span>
            <span>${escapeHtml(countText)}</span>
          </div>
        </div>
        ${
          products.length
            ? `<div class="picker-product-list">${products.map(pickerProductMarkup).join("")}</div>`
            : `<div class="picker-empty-cell">
                <strong>${state.query.trim() ? "검색 결과가 없습니다" : "해당 라인업 없음"}</strong>
                <span>${state.query.trim() ? "검색어를 바꾸거나 시기·브랜드·종류를 확인해 주세요." : "선택한 브랜드와 종류에 등록된 제품이 없습니다."}</span>
                ${state.query.trim() ? '<button class="picker-empty-clear" type="button" data-clear-search>검색어 지우기</button>' : ""}
              </div>`
        }
      `;
      wireImages();
    }

    function pickerProductMarkup(shoe) {
      const detailHref = detailHrefForItem(shoe);
      const href = detailHref ? `${detailHref}?${pickerParams()}` : "";
      const affordance = href
        ? `<span class="picker-card-affordance" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>`
        : "";
      const subParts = [selectedPickerBrand() === ALL_BRAND_VALUE ? shoe.brand : "", shoe.categoryGroup, shoe.category].filter(Boolean);
      const tagName = href ? "a" : "article";
      const cardAttrs = href
        ? `href="${escapeHtml(href)}" data-shoe-id="${escapeHtml(shoe.detailId)}" aria-label="${escapeHtml(`${shoe.brand} ${shoe.model} 상세 보기`)}"`
        : "";

      return `
        <${tagName} class="picker-product-card ${href ? "" : "picker-product-card--static"}" ${cardAttrs}>
          <div class="picker-product-card__media">
            ${imageMarkup(shoe, "picker")}
          </div>
          <div class="picker-product-card__body">
            <strong class="picker-product-card__name">${escapeHtml(shoe.displayName || shoe.model)}</strong>
            <span class="picker-product-card__sub">${escapeHtml(subParts.join(" · "))}</span>
            ${pickerEvidenceMarkup(shoe)}
            ${affordance}
          </div>
        </${tagName}>
      `;
    }

    function selectPickerAxis(axis, index, behavior = "smooth") {
      if (state.route !== "picker") return;
      const length = pickerAxisLength(axis);
      const nextIndex = (index + length) % length;
      setPickerAxisIndex(axis, nextIndex);
      updatePickerUrl();
      if (axis === "category" || axis === "brand") {
        state.pickerFilterPanel = "";
      }
      updatePickerAxisState(axis);
      renderPickerControls();
      renderPickerDetail();
      revealPickerAxisItem(axis, nextIndex, behavior);
      if (axis === "category") el.pickerCategoryTrigger.focus({ preventScroll: true });
    }

    function renderPicker() {
      renderPickerAxes();
      updatePickerAxisState("brand");
      updatePickerAxisState("category");
      renderPickerControls();
      renderPickerDetail();
    }

    function renderDetail(shoe) {
      el.detailView.innerHTML = content.detail(shoe, {
        backHref: state.lastBrowseRoute || pickerBrowseHref(), history: historyTimelineFor(shoe),
        review: window.RUNNING_RUNREPEAT?.reviewForShoe(shoe), priceConfig: priceQueryConfig, prefix: assetPrefix,
      });
      wireImages();
    }

    function wireImages() {
      document.querySelectorAll(".brand-logo__image").forEach((image) => {
        if (image.dataset.wired) return;
        image.dataset.wired = "true";
        const fallback = () => { image.closest(".brand-logo")?.classList.add("is-missing"); image.remove(); };
        image.addEventListener("error", fallback);
        if (image.complete && !image.naturalWidth) fallback();
      });
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
      cancelAnimationFrame(searchFrame);
      const revision = ++navigationRevision;
      const parsed = routes.parse(window.location, shoes);
      applyPickerParams(parsed.params);
      state.detailId = parsed.shoe?.id || "";
      if (parsed.detailRequested) {
        setRoute("detail");
        const shoe = parsed.shoe;
        setHidden(el.pickerView, true);
        setHidden(el.detailView, false);
        if (shoe) {
          if (parsed.legacy && location.protocol !== "file:") history.replaceState(history.state, "", `${routes.pathFor(shoe)}?${pickerParams()}`);
          renderDetail(shoe);
          updateMetadata(shoe);
        } else {
          updateMetadata();
          document.title = "상세 정보를 찾을 수 없습니다 | 러닝화 라인업";
          el.detailView.innerHTML = `
            <a class="back-link" href="${escapeHtml(state.lastBrowseRoute || "#/")}">← 집중 보기</a>
            <section class="empty-state">
              <h2>상세 정보를 찾을 수 없습니다</h2>
              <p>라인업으로 돌아가 다시 선택해 주세요.</p>
            </section>
          `;
        }
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }
      setRoute("picker");
      const browse = history.state?.browse;
      history.replaceState(browse ? { browse } : null, "", state.lastBrowseRoute);
      setHidden(el.pickerView, false);
      setHidden(el.detailView, true);
      renderPicker();
      updateMetadata();
      restoreBrowsePosition(state.lastBrowseRoute, revision);
    }

    function updateMetadata(shoe) {
      const title = shoe ? `${shoe.brand} ${shoe.displayName || shoe.model} | 러닝화 라인업` : "러닝화 라인업 | 브랜드·용도별 러닝화";
      const description = shoe ? `${shoe.brand} ${shoe.model}. ${shoe.categoryGroup} · ${shoe.category}. 러닝 갤러리 추천표 이력과 공식 제품 정보를 확인하세요.` : "브랜드와 용도별 러닝화 라인업, 분기별 추천표 이력과 공식 제품 정보를 확인하세요.";
      const url = routes.ORIGIN + (shoe ? routes.pathFor(shoe) : "/");
      document.title = title;
      for (const [selector, value] of [["meta[name=description]", description], ["meta[property='og:title']", title], ["meta[property='og:description']", description], ["meta[property='og:url']", url], ["meta[property='og:image']", routes.ORIGIN + "/" + (shoe || shoes[0]).imageUrl]]) {
        document.querySelector(selector)?.setAttribute("content", value);
      }
      document.querySelector("link[rel=canonical]")?.setAttribute("href", url);
      document.querySelector("meta[property='og:type']")?.setAttribute("content", shoe ? "product" : "website");
      let schema = document.querySelector("script[data-product-schema]");
      if (shoe) {
        if (!schema) { schema = document.createElement("script"); schema.type = "application/ld+json"; schema.dataset.productSchema = ""; document.head.append(schema); }
        schema.textContent = JSON.stringify(routes.productSchema(shoe));
      } else schema?.remove();
    }

    function updatePickerSearch(value) {
      state.query = value.slice(0, 200);
      el.pickerSearchInput.value = state.query;
      el.pickerSearchClear.hidden = !state.query;
      updatePickerUrl();
      renderPickerControls();
      renderPickerDetail();
    }

    el.pickerSearchInput.closest("form").addEventListener("submit", (event) => {
      event.preventDefault();
      cancelAnimationFrame(searchFrame);
      updatePickerSearch(el.pickerSearchInput.value);
      el.pickerSearchInput.blur();
    });
    el.pickerSearchInput.addEventListener("input", (event) => {
      if (event.isComposing) return;
      cancelAnimationFrame(searchFrame);
      searchFrame = requestAnimationFrame(() => updatePickerSearch(el.pickerSearchInput.value));
    });
    el.pickerSearchInput.addEventListener("compositionend", () => {
      cancelAnimationFrame(searchFrame);
      updatePickerSearch(el.pickerSearchInput.value);
    });
    el.pickerSearchClear.addEventListener("click", () => {
      cancelAnimationFrame(searchFrame);
      updatePickerSearch("");
      el.pickerSearchInput.focus();
    });
    el.pickerDetail.addEventListener("click", (event) => {
      const card = event.target.closest("a[data-shoe-id]");
      if (card && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        saveBrowsePosition(card.dataset.shoeId);
        history.pushState({ lineupDetail: true }, "", card.getAttribute("href"));
        syncRoute();
      }
      if (event.target.closest("[data-clear-search]")) {
        updatePickerSearch("");
        el.pickerSearchInput.focus();
      }
    });
    window.addEventListener("pagehide", () => saveBrowsePosition());

    el.pickerBrandAxis.addEventListener("click", (event) => {
      const item = event.target.closest("[data-axis=brand]");
      if (item) selectPickerAxis("brand", Number(item.dataset.logicalIndex));
    });
    el.pickerBrandAxis.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = event.key === "Home" ? 0 : event.key === "End" ? pickerBrandOptions.length - 1 : state.pickerBrandIndex + (event.key === "ArrowRight" ? 1 : -1);
      selectPickerAxis("brand", index);
      el.pickerBrandAxis.querySelector(`[data-logical-index="${state.pickerBrandIndex}"]`).focus({ preventScroll: true });
    });
    el.pickerView.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.pickerFilterPanel) {
        event.preventDefault();
        const trigger = state.pickerFilterPanel === "period" ? el.pickerPeriodTrigger : el.pickerCategoryTrigger;
        closePickerFilterPanels();
        trigger.focus({ preventScroll: true });
      }
    });

    el.detailView.addEventListener("click", (event) => {
      const back = event.target.closest("[data-browse-back]");
      if (back && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        if (history.state?.lineupDetail) history.back();
        else { history.pushState(null, "", back.getAttribute("href")); syncRoute(); }
      }
      const mode = event.target.closest("[data-history-scope]");
      if (mode) {
        const shoe = shoes.find((item) => item.id === state.detailId);
        const panel = el.detailView.querySelector(".history-panel");
        const expanded = panel.querySelector("details").open;
        panel.outerHTML = content.historyPanel(historyTimelineFor(shoe, mode.dataset.historyScope), mode.dataset.historyScope);
        el.detailView.querySelector(".history-panel details").open = expanded;
        el.detailView.querySelector(`[data-history-scope="${mode.dataset.historyScope}"]`).focus({ preventScroll: true });
      }
      if (event.target.closest("[data-evidence-help]")) openEvidenceHelp();
    });

    function openEvidenceHelp() {
      const shoe = shoes.find((item) => item.id === state.detailId);
      const review = window.RUNNING_RUNREPEAT?.reviewForShoe(shoe);
      const evidence = shoe.runRepeatEvidence;
      const dialog = document.querySelector("#evidenceDialog");
      dialog.querySelector(".evidence-dialog__content").innerHTML = `
        <p>${review ? `런리핏 ${review.score}: ${escapeHtml(review.checkedAt)}에 확인한 이 모델의 실점수입니다.` : evidence ? `런리핏 ${evidence.threshold}+: ${escapeHtml(evidence.asOf)} 추천표에 표시된 점수 기준이며 현재 실점수는 아닙니다.` : "런리핏 실점수가 확인된 모델에만 점수를 표시합니다."}</p>
        <p>디시 선호·신제품은 해당 분기 원문표의 표시입니다.</p>
        <p>연속 등장 뱃지는 이 모델 기준입니다. 이전 세대 이력은 ‘같은 계열’에서 확인할 수 있습니다.</p>`;
      dialog.showModal();
    }
    document.querySelector("#evidenceDialog").addEventListener("click", (event) => {
      if (event.target === event.currentTarget || event.target.closest("[data-dialog-close]")) event.currentTarget.close();
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

    document.addEventListener("click", (event) => {
      if (state.route !== "picker" || !state.pickerFilterPanel) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const insidePickerFilter = path.some((node) => node?.classList?.contains("picker-filter-dock") || node?.classList?.contains("picker-filter-panel"));
      if (insidePickerFilter || event.target.closest(".picker-filter-dock") || event.target.closest(".picker-filter-panel")) return;
      closePickerFilterPanels();
    });

    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    syncRoute();
  }

  const bootstrapReady = window.RUNNING_BOOTSTRAP_READY;
  if (bootstrapReady && typeof bootstrapReady.finally === "function") {
    bootstrapReady.finally(startRunningApp);
  } else {
    startRunningApp();
  }
})();
