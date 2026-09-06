(function () {
  // Manually checked on the exact model's RunRepeat review, not search snippets
  // or comparison-table neighbours. Store facts only, not review prose or media.
  const checkedAt = "2026-09-06";
  const rows = [
    ["nike-페가수스-프리미엄", "Nike", "페가수스 프리미엄", "Nike Pegasus Premium", 83, "nike-pegasus-premium"],
    ["nike-보메로-18", "Nike", "보메로 18", "Nike Vomero 18", 90, "nike-vomero-18"],
    ["nike-보메로-플러스", "Nike", "보메로 플러스", "Nike Vomero Plus", 91, "nike-vomero-plus"],
    ["nike-줌-플라이-6", "Nike", "줌 플라이 6", "Nike Zoom Fly 6", 88, "nike-zoom-fly-6"],
    ["nike-알파플라이-3", "Nike", "알파플라이 3", "Nike Alphafly 3", 93, "nike-alphafly-3"],
    ["adidas-보스턴-13", "Adidas", "보스턴 13", "adidas Adizero Boston 13", 88, "adidas-adizero-boston-13"],
    ["adidas-아디오스-프로-4", "Adidas", "아디오스 프로 4", "adidas Adizero Adios Pro 4", 93, "adidas-adizero-adios-pro-4"],
    ["hoka-본디-9", "HOKA", "본디 9", "HOKA Bondi 9", 86, "hoka-bondi-9"],
    ["new-balance-880-v15", "New Balance", "880 V15", "New Balance Fresh Foam X 880 v15", 82, "new-balance-fresh-foam-x-880-v-15"],
    ["on-클라우드-서퍼-2", "On", "클라우드 서퍼 2", "On Cloudsurfer 2", 80, "on-cloudsurfer-2"],
  ];
  const reviews = rows.map(([shoeId, brand, model, reviewModel, score, slug]) => ({
    shoeId, brand, model, reviewModel, score,
    scoreKind: "overall",
    sourceSection: "Our verdict / Our score",
    sourceUrl: `https://runrepeat.com/${slug}`,
    checkedAt,
    verified: true,
  }));
  const reviewById = new Map(reviews.map((review) => [review.shoeId, review]));

  function isValidReview(review, shoe, now) {
    if (!review || review.verified !== true || review.scoreKind !== "overall") return false;
    if (review.shoeId !== (shoe.detailId || shoe.id) || review.brand !== shoe.brand || review.model !== shoe.model) return false;
    if (!review.reviewModel || !review.sourceSection || !Number.isInteger(review.score) || review.score < 0 || review.score > 100) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(review.checkedAt || "")) return false;
    const date = new Date(`${review.checkedAt}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== review.checkedAt || date.getTime() > now) return false;
    try {
      const url = new URL(review.sourceUrl);
      return url.protocol === "https:" && url.hostname === "runrepeat.com" && !url.username && !url.password && /^\/[a-z0-9-]+$/.test(url.pathname) && !url.search && !url.hash;
    } catch {
      return false;
    }
  }

  function reviewForShoe(shoe, now = Date.now()) {
    if (!shoe || shoe.isHistoryItem) return null;
    // Never use fuzzy model-family matching for a review score.
    return [shoe.runRepeatReview, reviewById.get(shoe.detailId || shoe.id)]
      .filter((review) => isValidReview(review, shoe, now))
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0] || null;
  }

  window.RUNNING_RUNREPEAT = { reviews, reviewForShoe, isValidReview };
})();
