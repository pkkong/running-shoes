# 러닝화 추천표 MVP

디시 러닝 갤러리의 러닝화 라인업 표를 정적 웹앱으로 정리한 MVP입니다. 2026년 5월 표는 모델 단위로 구조화했고, 2024년 8월부터의 분기별 원문표 아카이브를 함께 연결합니다.

## 배포

https://pkkong.github.io/running-shoes/

## 실행

브라우저에서 `index.html`을 직접 열면 됩니다. 로컬 서버로 보고 싶다면 다음 명령을 사용할 수 있습니다.

```sh
python3 -m http.server 4173
```

## 데이터

- 구조화 데이터: `data/shoes.js`
- 분기별 라인업 이력: `data/lineup-history.js`
- 분기 아카이브: 2024.08, 2024.11, 2025.02, 2025.05, 2025.08, 2025.11, 2026.02, 2026.05
- 앱 구조화 데이터: 2026.05 기준 118개
- 보기 방식: 리스트, 맵, 집중 보기, 상세 페이지
- 분기 선택: 2024.08부터 2026.05까지 선택한 분기의 리스트/맵/집중 보기를 표시합니다.
- 변화 필터: 신규, 유지, 복귀, 제외, 연속 라인을 분리해서 볼 수 있습니다.
- 상세 페이지: `#/shoe/{id}`
- 상세 페이지에는 같은 브랜드·종류 셀 기준의 분기별 라인 등장 이력을 표시합니다.
- 2024.08~2026.02 이력은 원문표 이미지 OCR 구조화 후 수동 보정 기준이고, 2026.05는 앱 구조화 데이터 기준입니다.
- 사진: 브랜드 공식 사이트, 공식 CDN, 공식 뉴스룸 출처 URL
- 가격 스냅샷: `data/prices/latest.js`
- 가격 조회는 네이버 쇼핑 검색 API를 GitHub Actions에서 주기 실행해 정적 스냅샷으로 반영합니다. 브라우저에는 API 키를 노출하지 않습니다.
- 가격은 확정 최저가가 아니라 자동 매칭된 가격 후보입니다. 구매 전 쇼핑몰에서 사이즈, 배송비, 재고를 확인해야 합니다.
- 가격 알림 기능은 다음 단계 기능입니다.

## 가격 스냅샷 설정

GitHub 저장소 Secrets에 다음 값을 넣으면 매일 06:00, 18:00(KST)에 가격 스냅샷이 갱신됩니다.

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`

수동 실행:

```sh
NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/collect-prices.mjs --limit 3 --dry-run
NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/collect-prices.mjs
```

## 검증

```sh
node --check app.js
node --check data/shoes.js
node --check data/lineup-history.js
node --check data/price-queries.js
node --check data/prices/latest.js
node --check scripts/collect-prices.mjs
node --check scripts/audit-lineup-history.mjs
node --check scripts/audit-prices.mjs
node scripts/audit-lineup-history.mjs
node scripts/audit-images.mjs
node scripts/audit-prices.mjs
```
