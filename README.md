# 러닝화 추천표 MVP

디시 러닝 갤러리의 러닝화 라인업 표를 정적 웹앱으로 정리한 MVP입니다. 2024년 8월부터 2026년 5월까지의 분기별 추천표를 앱에서 탐색하기 좋게 정리했습니다.

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
- 앱 구조화 데이터: 2024.08~2026.05 분기별 라인업, 2026.05 기준 118개 상세 모델
- 보기 방식: 집중 보기(기본), 리스트, 맵, 상세 페이지
- 분기 선택: 2024.08부터 2026.05까지 선택한 분기의 리스트/맵/집중 보기를 표시합니다.
- 변화 필터: 신규, 유지, 복귀, 제외, 연속 라인을 분리해서 볼 수 있습니다.
- 상세 페이지: `#/shoe/{id}`
- 상세 페이지에는 같은 브랜드·종류 셀 기준의 분기별 라인 등장 이력을 표시합니다.
- 분기별 이력은 원문 추천표를 브랜드와 용도 기준으로 다시 정리한 앱 구조화 데이터입니다.
- 사진: 브랜드 공식 사이트, 공식 CDN, 공식 뉴스룸 출처 URL
- 가격 확인 기능은 현재 사용자 화면에서 준비중 상태로만 표시합니다.
- 가격 스냅샷/수집 스크립트는 다음 단계 검토용으로 보존하되, 현재 앱에서는 로드하지 않습니다.
- 판매처 연결은 정품 여부, 색상, 사이즈, 배송비 확인 기준을 정한 뒤 제공할 예정입니다.

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
