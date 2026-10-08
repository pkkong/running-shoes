# Korean official destinations

Updated 2026-10-07. The detail-page official action uses a Korean destination
for every current shoe. Photo assets and `imageSourceUrl` retain their actual
provenance, including overseas official sources.

## Destination policy

- Verified, same-model Korean product pages are pinned in `koreanProductPages`
  in `data/shoes.js` (21 products).
- Remaining models open model-specific searches inside the Korean official
  store (100 products). This does not assert domestic availability or stock.
- A search destination is labeled `한국 공식몰 검색`, not a product page.
- Do not manufacture product URLs by swapping a foreign domain or locale.
  Do not substitute a different generation or lifestyle variant.
- Product-page colors and gender options can differ from the displayed photo.

## Official stores and search contracts

| Brand | Korean store | Search path / parameter |
| --- | --- | --- |
| Nike | https://www.nike.com/kr/ | `/kr/w`, `q` |
| Adidas | https://www.adidas.co.kr/ | `/search`, `q` |
| ASICS | https://www.asics.co.kr/ | `/goods/search`, `search_text` |
| New Balance | https://www.nbkorea.com/ | `/product/searchResult.action`, `schWord` |
| Saucony | https://saucony.co.kr/ | `/product/search.html`, `keyword` |
| Puma | https://kr.puma.com/kr/ko/home | `/kr/ko/search`, `q` |
| HOKA | https://brand.naver.com/hoka | `/hoka/search`, `q` |
| Brooks | https://www.brooksrunning.co.kr/ | `/product/search.html`, `keyword` |
| Mizuno | https://kor.mizuno.com/ | `/product/search.html`, `keyword` |
| On | https://www.on.com/ko-kr/ | All 13 models have verified Korean product destinations |

HOKA's [Korean official channel](https://linktr.ee/hoka_korea) links to its
Naver brand store, including `/hoka/search?q=마하 X 3`. This is the brand's
official storefront, not a general Naver Shopping search or an affiliate link.

Search routes were checked via the stores' search UI/forms. Product destinations
were checked against Korean product listings/pages; automated access can be
blocked by a store even when browser navigation works.

## Verification

`node scripts/audit-official-links.mjs` validates coverage, brand-specific
domains/locales, destination types, nonempty search terms and verification dates.
It is included in `node --run audit`.

After deployment, run:

```sh
node scripts/audit-official-links.mjs --url=https://runfit-lineup.vercel.app
```

This additionally checks the served bootstrap against local intended links.
The audit checks destination policy and deployment freshness, not live inventory
or future product-page availability.
