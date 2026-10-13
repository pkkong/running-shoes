(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RUNNING_SHOE_ROUTES = api;
})(typeof window === "object" ? window : globalThis, function () {
  const ORIGIN = "https://runfit-lineup.vercel.app";
  function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function pathFor(shoe) { return `/shoes/${slug(`${shoe.brand}-${shoe.displayName || shoe.model}`)}/`; }
  function parse(location, shoes) {
    const hash = location.hash || "";
    const [legacyPath, legacyQuery = ""] = hash.split("?");
    let legacyId = "";
    if (legacyPath.startsWith("#/shoe/")) {
      try { legacyId = decodeURIComponent(legacyPath.slice(7)); } catch {}
    }
    const pathname = location.pathname.replace(/\/$/, "") + "/";
    const shoe = legacyId ? shoes.find((item) => item.id === legacyId)
      : shoes.find((item) => pathFor(item) === pathname);
    return { shoe, detailRequested: legacyPath.startsWith("#/shoe/") || pathname.startsWith("/shoes/"), params: new URLSearchParams(hash.startsWith("#/") ? legacyQuery : location.search), legacy: hash.startsWith("#/") };
  }
  function productSchema(shoe) {
    return { "@context": "https://schema.org", "@type": "Product", name: shoe.displayName || shoe.model,
      brand: { "@type": "Brand", name: shoe.brand }, image: ORIGIN + "/" + shoe.imageUrl,
      category: `${shoe.categoryGroup} · ${shoe.category}`, url: ORIGIN + pathFor(shoe) };
  }
  return { ORIGIN, pathFor, parse, productSchema };
});
