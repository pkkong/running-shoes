(function () {
  const STATIC_SOURCE = "static";
  const API_SOURCE = "supabase";
  const API_TIMEOUT_MS = 1800;

  window.RUNNING_BOOTSTRAP_SOURCE = STATIC_SOURCE;

  function hasUsableBootstrap(data) {
    return Boolean(
      data &&
        Array.isArray(data.shoes) &&
        data.shoes.length &&
        data.lineupHistory &&
        Array.isArray(data.lineupHistory.periods) &&
        data.lineupHistory.periods.length &&
        Array.isArray(data.lineupHistory.entries)
    );
  }

  function applyBootstrap(data) {
    window.RUNNING_SHOES = data.shoes;
    window.RUNNING_LINEUP_HISTORY = data.lineupHistory;
    window.RUNNING_LINEUP_PERIODS = data.lineupHistory.periods;
    window.RUNNING_PRICE_QUERY_CONFIG = data.priceQueryConfig || window.RUNNING_PRICE_QUERY_CONFIG || {};
    window.RUNNING_LINEUP_VERSION = data.version || data.lineupHistory.version || window.RUNNING_LINEUP_VERSION;
    window.RUNNING_BOOTSTRAP_SOURCE = data.source || API_SOURCE;
  }

  async function loadBootstrap() {
    if (shouldUseStaticOnly()) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/bootstrap?v=${encodeURIComponent(window.RUNNING_LINEUP_VERSION || "static")}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`bootstrap ${response.status}`);
      }

      const data = await response.json();
      if (hasUsableBootstrap(data)) {
        applyBootstrap(data);
      }
    } catch (error) {
      window.RUNNING_BOOTSTRAP_SOURCE = STATIC_SOURCE;
      if (isDebugBootstrap() && window.console && typeof window.console.warn === "function") {
        window.console.warn("Using static lineup fallback.", error);
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function isDebugBootstrap() {
    return new URLSearchParams(window.location.search).get("debugBootstrap") === "1";
  }

  function shouldUseStaticOnly() {
    if (window.location.protocol === "file:") return true;
    return window.location.hostname.endsWith("github.io");
  }

  window.RUNNING_BOOTSTRAP_READY = loadBootstrap();
})();
