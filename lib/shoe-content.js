(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RUNNING_SHOE_CONTENT = api;
})(typeof window === "object" ? window : globalThis, function () {
  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }
  const logos = { Nike: "nike.png", Adidas: "adidas.svg", ASICS: "asics.svg", "New Balance": "new-balance.svg", Saucony: "saucony.svg", Puma: "puma.svg", HOKA: "hoka.svg", Brooks: "brooks.svg", Mizuno: "mizuno-wordmark.svg", On: "on-wordmark.svg" };
  function brandLogo(brand, prefix = "/") {
    const key = String(brand).toLowerCase().replace(/\s/g, "");
    return `<span class="brand-logo brand-logo--${escape(key)}" aria-hidden="true">${logos[brand] ? `<img class="brand-logo__image" src="${prefix}assets/logos/${logos[brand]}" alt="" decoding="async" />` : ""}<span class="brand-logo__fallback">${escape(brand)}</span></span>`;
  }
  function image(shoe, variant, prefix = "/") {
    const url = shoe.imageUrl?.startsWith("assets/") ? prefix + shoe.imageUrl : shoe.imageUrl;
    return `<div class="shoe-image shoe-image--${variant}${url ? "" : " is-failed"}" style="--shoe-fit: ${escape(shoe.imageFit || "contain")}; --shoe-position: ${escape(shoe.imagePosition || "center")}; --shoe-scale: ${escape(shoe.imageScale || 1)}"><div class="shoe-image__placeholder"><strong>${escape(shoe.brand)}</strong><span>${escape(shoe.model)}</span></div>${url ? `<img src="${escape(url)}" alt="${escape(`${shoe.brand} ${shoe.model}`)}" loading="lazy" decoding="async" data-shoe-image />` : ""}</div>`;
  }
  function evidence(shoe, history, review) {
    const items = [];
    if (review) items.push({ label: `런리핏 ${review.score}`, title: `${review.checkedAt} 확인한 RunRepeat 실점수` });
    else if (!shoe.isHistoryItem && shoe.tags?.includes("runRepeatGreat") && shoe.runRepeatEvidence?.kind === "chart-threshold" && shoe.runRepeatEvidence.sourceUrl && Number.isFinite(shoe.runRepeatEvidence.threshold) && shoe.runRepeatEvidence.threshold > 0 && shoe.runRepeatEvidence.threshold <= 100) {
      items.push({ label: `런리핏 ${shoe.runRepeatEvidence.threshold}+`, title: `${shoe.runRepeatEvidence.asOf} 추천표의 점수 기준 표시. 현재 실점수는 아닙니다.` });
    }
    if (shoe.tags?.includes("runGalleryPick")) items.push({ label: "디시 선호" });
    if (shoe.isAllPeriodItem) items.push({ label: `계열 ${shoe.archiveAppearanceCount}분기 등장`, title: `${shoe.category} 분류의 같은 계열 등장 횟수. ${shoe.archivePeriodRange || ""}` });
    else if (history.streak >= 2) items.push({ label: `${history.streak}분기 연속` });
    else if (history.count === 1) items.push({ label: "신규 등장" });
    else if (history.count) items.push({ label: `${history.count}분기 등장` });
    if (shoe.tags?.includes("newProduct")) items.push({ label: "신제품" });
    return items.map(({ label, title }) => `<span class="lineup-feature-badge"${title ? ` title="${escape(title)}" aria-label="${escape(`${label}. ${title}`)}"` : ""}>${escape(label)}</span>`).join("");
  }
  function historyPanel(history, scope = "model") {
    return `<section class="history-panel history-panel--v2" aria-label="추천표 이력"><div class="history-panel__head"><h3>추천표 이력</h3><div class="history-scope" role="group" aria-label="추천 이력 범위"><button type="button" data-history-scope="model" aria-pressed="${scope === "model"}">이 모델</button><button type="button" data-history-scope="family" aria-pressed="${scope === "family"}">같은 계열</button></div></div><div class="history-period-chips" aria-label="${scope === "model" ? "이 모델" : "같은 계열"} 등장 분기">${history.timeline.map(({ period, matched }) => `<span class="${matched ? "is-active" : ""}" aria-label="${escape(`${period.label} ${matched ? "등장" : "미등장"}`)}">${escape(period.label)}</span>`).join("")}</div><details class="history-timeline-disclosure"><summary>전체 기록</summary><ol class="history-timeline">${history.timeline.map(({ period, models, matched }) => `<li class="history-period ${matched ? "is-matched" : ""}"><span class="history-period__date">${escape(period.label)}</span><span class="history-period__models">${models.length ? models.map((model) => `<span>${escape(model)}</span>`).join("") : '<span class="history-period__empty">미등장</span>'}</span></li>`).join("")}</ol></details></section>`;
  }
  function shoppingLinks(shoe, config = {}) {
    const override = config.overrides?.[shoe.id] || {};
    const query = override.query || [override.brand || config.brandQueryNames?.[shoe.brand] || shoe.brand, override.model || shoe.model, override.suffix ?? config.defaultSuffix ?? "러닝화"].filter(Boolean).join(" ");
    return [
      { id: "naver", label: "네이버", url: `https://search.shopping.naver.com/search/all?${new URLSearchParams({ query, origQuery: query, adQuery: query, pagingIndex: "1", pagingSize: "40", productSet: "total", sort: "price_asc", viewType: "list" })}` },
      { id: "coupang", label: "쿠팡", url: `https://www.coupang.com/np/search?${new URLSearchParams({ q: query, channel: "user" })}` },
    ];
  }
  function detail(shoe, { backHref = "/", history, review, priceConfig, prefix = "/" }) {
    const officialLabel = shoe.officialLinkKind === "search" ? "한국 공식몰 검색" : "한국 공식 페이지";
    return `<a class="back-link" href="${escape(backHref)}" data-browse-back>← 라인업으로</a>
      <article class="detail-card detail-card--v2"><div class="detail-card__media">${image(shoe, "detail", prefix)}</div><div class="detail-card__content"><div class="detail-brand-line">${brandLogo(shoe.brand, prefix)}<span>${escape(shoe.categoryGroup)} · ${escape(shoe.category)}</span></div><h2>${escape(shoe.displayName || shoe.model)}</h2><div class="detail-feature-row"><div class="detail-feature-badges" aria-label="${escape(`${shoe.brand} ${shoe.model} 특징`)}">${evidence(shoe, history, review)}</div><button type="button" class="evidence-help" data-evidence-help aria-label="뱃지 기준 확인" title="뱃지 기준 확인">?</button></div><div class="detail-actions"><a class="detail-action detail-action--secondary" href="${escape(shoe.officialProductUrl)}" target="_blank" rel="noreferrer" aria-label="${escape(`${shoe.brand} ${shoe.model} ${officialLabel}, 새 창`)}"><strong>${officialLabel}</strong></a>${review ? `<a class="detail-action detail-action--secondary" href="${escape(review.sourceUrl)}" target="_blank" rel="noreferrer"><strong>런리핏 리뷰</strong></a><span class="detail-review-date">${escape(review.checkedAt.replace(/-/g, "."))} 확인</span>` : ""}</div></div></article>
      <section id="price-check" class="price-panel price-panel--search price-panel--v2" aria-label="가격 직접 확인"><div class="price-panel__head"><h3>가격 직접 확인</h3></div><div class="platform-search-grid">${shoppingLinks(shoe, priceConfig).map((link) => `<a class="platform-search-link platform-search-link--${link.id} platform-search-link--panel" href="${escape(link.url)}" target="_blank" rel="noreferrer" aria-label="${escape(`${shoe.brand} ${shoe.model} ${link.label}에서 직접 확인`)}"><span>${link.label}</span></a>`).join("")}</div><p class="price-panel__caution">판매처, 사이즈, 배송비는 각 플랫폼에서 직접 확인하세요.</p></section>
      ${historyPanel(history)}`;
  }
  return { escape, brandLogo, image, evidence, historyPanel, shoppingLinks, detail };
});
