import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadStaticBootstrap } = require("../lib/bootstrap-data.js");
const identity = require("../lib/lineup-models.js");
const content = require("../lib/shoe-content.js");
const routes = require("../lib/shoe-routes.js");
const data = loadStaticBootstrap();
const index = identity.createIndex(data.shoes, data.lineupHistory.periods, data.lineupHistory.entries);
const template = fs.readFileSync(path.join(root, "index.html"), "utf8");
const favicon = template.match(/<link rel="icon"[^>]+>/)?.[0] || "";
const paths = new Set();
const descriptionFor = (shoe) => `${shoe.brand} ${shoe.model}. ${shoe.categoryGroup} · ${shoe.category}. 러닝 갤러리 추천표 이력과 공식 제품 정보를 확인하세요.`;
for (const shoe of data.shoes) {
  const route = routes.pathFor(shoe);
  if (paths.has(route)) throw new Error(`Duplicate product URL: ${route}`);
  paths.add(route);
  const title = `${shoe.brand} ${shoe.displayName} | 러닝화 라인업`;
  const url = routes.ORIGIN + route;
  const review = shoe.runRepeatReview;
  const head = `<head>
    <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${content.escape(title)}</title>
    <meta name="description" content="${content.escape(descriptionFor(shoe))}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="product" /><meta property="og:site_name" content="러닝화 라인업" />
    <meta property="og:title" content="${content.escape(title)}" /><meta property="og:description" content="${content.escape(descriptionFor(shoe))}" />
    <meta property="og:url" content="${url}" /><meta property="og:image" content="${routes.ORIGIN}/${content.escape(shoe.imageUrl)}" />
    <meta property="og:image:width" content="1600" /><meta property="og:image:height" content="1200" />
    <meta name="twitter:card" content="summary_large_image" />
    ${favicon}
    <link rel="stylesheet" href="/styles.css?v=20261013-ux-1" />
    <script type="application/ld+json" data-product-schema>${JSON.stringify(routes.productSchema(shoe)).replace(/</g, "\\u003c")}</script>
  </head>`;
  let html = template.replace(/<head>[\s\S]*?<\/head>/, head).replace("<body>", '<body data-route="detail">');
  html = html.replace('<section id="detailView" class="detail-view" aria-label="러닝화 상세" hidden></section>',
    `<section id="detailView" class="detail-view" aria-label="러닝화 상세">${content.detail(shoe, {
      history: index.timelineFor(shoe), review, priceConfig: data.priceQueryConfig,
    })}</section>`);
  html = html.replace(/src="((?:data|lib)\/[^" ]+|(?:app|runtime-data)\.js[^" ]*)"/g, 'src="/$1"');
  const directory = path.join(root, route);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), html);
}
fs.writeFileSync(path.join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", ...paths].map((route) => `<url><loc>${routes.ORIGIN}${route}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log(`Generated ${paths.size} product pages and sitemap using the shared detail renderer`);
