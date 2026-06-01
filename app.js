(function () {
  const shoes = window.RUNNING_SHOES || [];
  const periods = window.RUNNING_LINEUP_PERIODS || [];
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
    pickerBrandAxis: document.querySelector("#pickerBrandAxis"),
    pickerCategoryAxis: document.querySelector("#pickerCategoryAxis"),
    pickerDetail: document.querySelector("#pickerDetail"),
  };

  const categoryGroupMap = shoes.reduce((acc, shoe) => {
    acc[shoe.category] = shoe.categoryGroup;
    return acc;
  }, {});

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

    return shoes
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

    return shoes
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

  function tagMarkup(tags, compact = false) {
    if (!tags.length) {
      return compact ? "" : '<span class="muted">표시 없음</span>';
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
    return priceSnapshot.items?.[shoe.id] || null;
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

  function priceBadgeMarkup(shoe, showPending = true) {
    const info = priceInfoFor(shoe);
    if (info?.status === "found") {
      return `<span class="price-pill price-pill--ready">최저 ${formatWon(info.lowestPrice)}</span>`;
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
        <img
          src="${escapeHtml(shoe.imageUrl)}"
          alt="${escapeHtml(`${shoe.brand} ${shoe.model}`)}"
          loading="lazy"
          decoding="async"
          data-shoe-image
        />
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
        <img
          src="${escapeHtml(shoe.imageUrl)}"
          alt="${escapeHtml(`${shoe.brand} ${shoe.model}`)}"
          loading="lazy"
          decoding="async"
          data-shoe-image
        />
      </span>
    `;
  }

  function cardMarkup(shoe) {
    return `
      <a class="shoe-card" href="#/shoe/${encodeURIComponent(shoe.id)}">
        ${imageMarkup(shoe, "card")}
        <span class="shoe-card__body">
          <span class="shoe-card__brand">${brandLogoMarkup(shoe.brand)}</span>
          <strong>${escapeHtml(shoe.model)}</strong>
          <span class="shoe-card__meta">
            <span>${escapeHtml(shoe.categoryGroup)}</span>
            <span>${escapeHtml(shoe.category)}</span>
          </span>
          <span class="tag-list">${tagMarkup(shoe.tags)}</span>
          ${priceBadgeMarkup(shoe, false)}
        </span>
      </a>
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

  function mapColumnWidthToken() {
    return "var(--map-cell-width)";
  }

  function renderMapControls() {
    renderSegmentButtons(el.mapGroupFilters, ["전체", ...groupOrder], state.group, (value) => {
      state.group = value;
      renderOverview();
    }, groupLabel);

    renderSegmentButtons(el.mapBrandFilters, ["전체", ...brandOrder], state.brand, (value) => {
      state.brand = value;
      renderOverview();
    });

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

    el.mapSummary.textContent = `${items.length}개 제품 · ${filledCells}/${totalCells}개 구역`;
    el.shoeMapCanvas.style.setProperty("--map-zoom", state.mapZoom);
    el.shoeMapCanvas.innerHTML = `
      <div class="shoe-map-grid" style="grid-template-columns: ${escapeHtml(gridColumns)};">
        <div class="map-axis-corner">용도</div>
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
                <strong title="${escapeHtml(`${groupLabel(row.group)} · ${row.label}`)}">${escapeHtml(row.label)}</strong>
              </div>
              ${row.cells
                .map((cell) => {
                  const disabled = cell.count === 0;
                  const primaryShoe = cell.shoes[0];
                  const primaryLabel = primaryShoe ? primaryShoe.displayName || primaryShoe.model : "";
                  const label = disabled
                    ? `${cell.brand} ${row.label} 제품 없음`
                    : `${cell.brand} ${row.label} ${cell.count}개: ${cell.productNames}. 제품 목록 보기`;
                  return `
                    <button
                      class="map-cell ${cellIntensity(cell.count, maxCount)} ${
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
                          ? `<span class="map-cell__media">
                              ${mapImageMarkup(primaryShoe)}
                              ${
                                cell.count > 1
                                  ? `<span class="map-cell__badge" aria-hidden="true">${cell.count}개</span>`
                                  : ""
                              }
                        </span>`
                          : ""
                      }
                      <span class="map-cell__body">
                        <span class="map-cell__count">${
                          cell.count ? escapeHtml(cell.count === 1 ? primaryLabel : "전체 보기") : "없음"
                        }</span>
                        <span class="map-cell__name">
                          ${cell.count ? escapeHtml(cell.count === 1 ? "1개 제품" : `${cell.count}개 제품`) : "제품 없음"}
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
    const categoryOptions =
      state.group === "전체"
        ? categoryOrder
        : categoryOrder.filter((category) => shoes.some((shoe) => shoe.categoryGroup === state.group && shoe.category === category));

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
  }

  function renderPeriodArchive() {
    if (!el.periodArchive || !periods.length) return;
    const active = periods.find((period) => period.active) || periods[periods.length - 1];
    const sourceLinks = [...periods]
      .reverse()
      .map(
        (period) => `
          <a
            class="period-link ${period.id === active.id ? "is-active" : ""}"
            href="${escapeHtml(period.sourcePostUrl)}"
            target="_blank"
            rel="noreferrer"
            aria-label="${escapeHtml(`${period.label} 러닝화 라인업 원문 보기`)}"
          >
            <span>${escapeHtml(period.label)}</span>
            <small>${escapeHtml(period.status)}</small>
          </a>
        `
      )
      .join("");

    el.periodArchive.innerHTML = `
      <div class="period-archive__head">
        <div>
          <p class="eyebrow">Lineup Archive</p>
          <h2>분기</h2>
        </div>
        <div class="period-archive__actions">
          <a class="period-source" href="${escapeHtml(active.sourcePostUrl)}" target="_blank" rel="noreferrer">최신 원문</a>
          <a class="period-source" href="${escapeHtml(active.tableImageUrl)}" target="_blank" rel="noreferrer">원본표</a>
        </div>
      </div>
      <div class="period-archive__rail" aria-label="분기별 원문 링크">
        ${sourceLinks}
      </div>
    `;
  }

  function titleForActiveFilters() {
    const titleParts = [state.brand, state.group, state.category].filter((value) => value !== "전체");
    return titleParts.length ? titleParts.join(" · ") : "추천표 전체";
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
    el.overviewTitle.textContent = "브랜드 × 용도 맵";
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
    return shoes.filter((shoe) => shoe.brand === brand && shoe.category === category);
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
    el.pickerCoordinate.textContent = coordinate;
    el.pickerDetail.className = `picker-detail-card picker-detail-card--${products.length ? "filled" : "empty"}`;

    el.pickerDetail.innerHTML = `
      <div class="picker-detail-card__head" aria-label="${escapeHtml(coordinate)}">
        <h3 class="visually-hidden">${escapeHtml(`${categoryGroup ? `${categoryGroup} · ` : ""}${coordinate}`)}</h3>
        <span class="picker-count-pill">${products.length ? `${products.length}개 제품` : "라인업 없음"}</span>
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
    return `
      <a class="picker-product-card" href="#/shoe/${encodeURIComponent(shoe.id)}" aria-label="${escapeHtml(`${shoe.brand} ${shoe.model} 상세 보기`)}">
        ${imageMarkup(shoe, "picker")}
        <span class="picker-product-card__body">
          <strong>${escapeHtml(shoe.displayName || shoe.model)}</strong>
        </span>
      </a>
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
        <section class="price-panel" aria-label="최저가 탐색">
          <div class="price-panel__head">
            <div>
              <p class="eyebrow">PRICE</p>
              <h3>최저가 탐색</h3>
            </div>
            <span class="price-pill price-pill--ready">${priceConfidenceLabel(info.confidence)}</span>
          </div>
          <a class="price-panel__lowest" href="${escapeHtml(info.lowestOffer?.link || searchUrl)}" target="_blank" rel="noreferrer">
            <span>
              <span class="price-panel__label">현재 최저가</span>
              <strong>${formatWon(info.lowestPrice)}</strong>
            </span>
            <span class="price-panel__mall">${escapeHtml(info.lowestOffer?.mallName || "네이버 쇼핑")}</span>
          </a>
          <div class="price-panel__meta">
            <span>${generatedLabel ? `${escapeHtml(generatedLabel)} 기준` : "최근 스냅샷 기준"}</span>
            <a href="${escapeHtml(searchUrl)}" target="_blank" rel="noreferrer">네이버 쇼핑 검색</a>
          </div>
          <div class="price-offer-list" aria-label="가격 후보">
            ${offers.map(priceOfferMarkup).join("")}
          </div>
        </section>
      `;
    }

    const message = !hasPriceSnapshot()
      ? "아직 가격 스냅샷이 없습니다. API 키가 연결되면 GitHub Actions가 자동으로 최저가를 채웁니다."
      : info?.message || "조건에 맞는 자동 매칭 결과가 없습니다. 검색 결과를 직접 확인해 주세요.";

    return `
      <section class="price-panel price-panel--pending" aria-label="최저가 탐색">
        <div class="price-panel__head">
          <div>
            <p class="eyebrow">PRICE</p>
            <h3>최저가 탐색</h3>
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
    const backLabel = backHref === "#/overview" ? "한눈에 보기" : backHref === "#/picker" ? "피커 보기" : "목록 보기";

    el.detailView.innerHTML = `
      <a class="back-link" href="${escapeHtml(backHref)}">← ${backLabel}</a>
      <article class="detail-card">
        <div class="detail-card__media">
          ${imageMarkup(shoe, "detail")}
        </div>
        <div class="detail-card__content">
          <p class="eyebrow">${escapeHtml(shoe.brand)} · ${escapeHtml(shoe.displayName || shoe.model)}</p>
          <h2>${escapeHtml(shoe.model)}</h2>
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
            ${priceBadgeMarkup(shoe)}
          </div>
        </div>
      </article>
      ${pricePanelMarkup(shoe)}
    `;
    wireImages();
  }

  function sheetProductMarkup(shoe) {
    return `
      <a class="sheet-product" href="#/shoe/${encodeURIComponent(shoe.id)}">
        <span class="sheet-product__name">${escapeHtml(shoe.model)}</span>
        <span class="sheet-product__meta">${escapeHtml(shoe.categoryGroup)} · ${escapeHtml(shoe.category)}</span>
        <span class="sheet-product__tags">${tagMarkup(shoe.tags)}</span>
      </a>
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
          <p>이 구역에는 제품 ${countText}가 있습니다.</p>
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
    window.location.hash = "#/";
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
          <a class="back-link" href="${escapeHtml(state.lastBrowseRoute || "#/")}">← 목록 보기</a>
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

    if (hash === "#/picker") {
      setRoute("picker");
      state.lastBrowseRoute = "#/picker";
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

    setRoute("home");
    state.lastBrowseRoute = "#/";
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
    state.tags.clear();
    state.sort = "table";
    el.searchInput.value = "";
    el.sortSelect.value = "table";
    renderCurrentRoute();
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
