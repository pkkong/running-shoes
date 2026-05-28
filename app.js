(function () {
  const shoes = window.RUNNING_SHOES || [];

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

  const state = {
    query: "",
    brand: "전체",
    group: "전체",
    category: "전체",
    tags: new Set(),
    sort: "table",
    detailId: "",
  };

  const el = {
    homeView: document.querySelector("#homeView"),
    detailView: document.querySelector("#detailView"),
    searchInput: document.querySelector("#searchInput"),
    brandFilters: document.querySelector("#brandFilters"),
    groupFilters: document.querySelector("#groupFilters"),
    categoryFilters: document.querySelector("#categoryFilters"),
    tagFilters: document.querySelector("#tagFilters"),
    overviewMatrix: document.querySelector("#overviewMatrix"),
    shoeGrid: document.querySelector("#shoeGrid"),
    emptyState: document.querySelector("#emptyState"),
    resultMeta: document.querySelector("#resultMeta"),
    resultTitle: document.querySelector("#resultTitle"),
    sortSelect: document.querySelector("#sortSelect"),
    resetButton: document.querySelector("#resetButton"),
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

  function getVisibleBrands() {
    return state.brand === "전체" ? brandOrder : brandOrder.filter((brand) => brand === state.brand);
  }

  function getVisibleRows() {
    return categoryOrder
      .map((category) => ({ category, group: categoryGroupMap[category] }))
      .filter((row) => state.group === "전체" || row.group === state.group)
      .filter((row) => state.category === "전체" || row.category === state.category);
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
        renderHome();
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

  function imageMarkup(shoe, variant) {
    const style = [
      `--image-fit:${shoe.imageFit || "contain"}`,
      `--image-position:${shoe.imagePosition || "center"}`,
      `--image-scale:${shoe.imageScale || 1}`,
    ].join(";");

    return `
      <div class="shoe-image shoe-image--${variant}" style="${style}">
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

  function matrixTileMarkup(shoe) {
    return `
      <a class="matrix-tile" href="#/shoe/${encodeURIComponent(shoe.id)}" title="${escapeHtml(`${shoe.brand} ${shoe.model}`)}">
        ${imageMarkup(shoe, "matrix")}
        <span class="matrix-tile__name">${escapeHtml(shoe.model)}</span>
        <span class="matrix-tile__meta">
          ${dropMarkup(shoe, false)}
          <span class="tag-dots">${tagMarkup(shoe.tags, true)}</span>
        </span>
      </a>
    `;
  }

  function cardMarkup(shoe) {
    const priceLabel = shoe.priceStatus === "planned" ? "시세 조회 예정" : "가격 확인";

    return `
      <a class="shoe-card" href="#/shoe/${encodeURIComponent(shoe.id)}">
        ${imageMarkup(shoe, "card")}
        <span class="shoe-card__body">
          <span class="shoe-card__brand">${escapeHtml(shoe.brand)}</span>
          <strong>${escapeHtml(shoe.model)}</strong>
          <span class="shoe-card__meta">
            <span>${escapeHtml(shoe.categoryGroup)}</span>
            <span>${escapeHtml(shoe.category)}</span>
            ${dropMarkup(shoe)}
          </span>
          <span class="tag-list">${tagMarkup(shoe.tags)}</span>
          <span class="price-pill">${priceLabel}</span>
        </span>
      </a>
    `;
  }

  function renderMatrix(items) {
    const brands = getVisibleBrands();
    const rows = getVisibleRows();
    const groupSpan = rows.reduce((acc, row) => {
      acc[row.group] = (acc[row.group] || 0) + 1;
      return acc;
    }, {});
    const seenGroups = new Set();

    const bodyRows = rows
      .map((row) => {
        const groupCell = seenGroups.has(row.group)
          ? ""
          : `<th class="matrix-group" scope="rowgroup" rowspan="${groupSpan[row.group]}">${escapeHtml(row.group)}</th>`;
        seenGroups.add(row.group);

        const cells = brands
          .map((brand) => {
            const cellShoes = items.filter((shoe) => shoe.brand === brand && shoe.category === row.category);
            return `
              <td>
                <div class="matrix-cell ${cellShoes.length ? "" : "is-empty"}">
                  ${cellShoes.map(matrixTileMarkup).join("")}
                </div>
              </td>
            `;
          })
          .join("");

        return `
          <tr>
            ${groupCell}
            <th class="matrix-category" scope="row">${escapeHtml(row.category)}</th>
            ${cells}
          </tr>
        `;
      })
      .join("");

    el.overviewMatrix.innerHTML = `
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="matrix-corner" colspan="2">구분</th>
            ${brands.map((brand) => `<th scope="col">${escapeHtml(brand)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
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
      renderHome();
    });
    renderChoiceButtons(el.groupFilters, ["전체", ...groupOrder], state.group, (value) => {
      state.group = value;
      renderHome();
    });
    renderChoiceButtons(el.categoryFilters, ["전체", ...categoryOptions], state.category, (value) => {
      state.category = value;
      renderHome();
    });
    renderTagButtons();
  }

  function renderHome() {
    const items = getFilteredShoes();
    const titleParts = [state.brand, state.group, state.category].filter((value) => value !== "전체");
    el.resultTitle.textContent = titleParts.length ? titleParts.join(" · ") : "추천표 전체";
    el.resultMeta.textContent = `${items.length}개 모델 · 공식 사진 기준`;
    renderFilters();
    renderMatrix(items);
    renderResults(items);
    wireImages();
  }

  function renderDetail(shoe) {
    const priceLabel = shoe.priceStatus === "planned" ? "시세 조회 예정" : "가격 확인";

    el.detailView.innerHTML = `
      <a class="back-link" href="#/">← 한눈에 보기</a>
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
            <span class="price-pill">${priceLabel}</span>
          </div>
        </div>
      </article>
    `;
    wireImages();
  }

  function wireImages() {
    document.querySelectorAll("img[data-shoe-image]").forEach((image) => {
      if (image.dataset.wired) return;
      image.dataset.wired = "true";
      image.addEventListener("load", () => {
        image.closest(".shoe-image")?.classList.add("is-loaded");
      });
      image.addEventListener("error", () => {
        const box = image.closest(".shoe-image");
        if (box) {
          box.classList.add("is-failed");
        }
      });
      if (image.complete && image.naturalWidth > 0) {
        image.closest(".shoe-image")?.classList.add("is-loaded");
      }
    });
  }

  function syncRoute() {
    const hash = decodeURIComponent(window.location.hash || "#/");
    const match = hash.match(/^#\/shoe\/(.+)$/);
    state.detailId = match ? match[1] : "";

    if (state.detailId) {
      const shoe = shoes.find((item) => item.id === state.detailId);
      el.homeView.hidden = true;
      el.detailView.hidden = false;
      if (shoe) {
        renderDetail(shoe);
      } else {
        el.detailView.innerHTML = `
          <a class="back-link" href="#/">← 한눈에 보기</a>
          <section class="empty-state">
            <h2>상세 정보를 찾을 수 없습니다</h2>
            <p>추천표로 돌아가 다시 선택해 주세요.</p>
          </section>
        `;
      }
      window.scrollTo(0, 0);
      return;
    }

    el.homeView.hidden = false;
    el.detailView.hidden = true;
    renderHome();
  }

  el.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderHome();
  });

  el.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderHome();
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
    renderHome();
  });

  window.addEventListener("hashchange", syncRoute);
  syncRoute();
})();
