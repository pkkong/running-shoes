# 러닝화 추천표 MVP

디시 러닝 갤러리의 러닝화 라인업 표를 정적 웹앱으로 정리한 MVP입니다. 2024년 8월부터 2026년 5월까지의 분기별 추천표를 앱에서 탐색하기 좋게 정리했습니다.

## 배포

운영 배포는 Vercel이 담당합니다. GitHub Pages는 이전 정적 배포용으로만 남기고, Vercel 검증 후 비활성화합니다.

- Production target: Vercel 프로젝트 `runfit-lineup`
- Source: GitHub `pkkong/running-shoes`
- Database/API data source: Supabase 지원. 현재 운영은 환경변수 미설정으로 정적 fallback 사용.
- 런리핏 실점수 10개 모델: 출처·확인일·저장 방식은 [점수 데이터 안내](docs/runrepeat-reviews.md) 참고.

## 실행

브라우저에서 `index.html`을 직접 열면 정적 fallback으로 동작합니다. Vercel 서버리스 API까지 함께 확인하려면 로컬 Vercel-like 서버를 사용합니다.

```sh
python3 -m http.server 4173

# Vercel API 포함 확인
node scripts/serve-vercel-like.mjs
```

## 데이터

- 운영 데이터: Supabase `runfit_lineup_periods`, `runfit_shoes`, `runfit_lineup_items`, `runfit_price_query_config`
- 정적 fallback 데이터: `data/shoes.js`, `data/lineup-history.js`, `data/price-queries.js`
- 분기 아카이브: 2024.08, 2024.11, 2025.02, 2025.05, 2025.08, 2025.11, 2026.02, 2026.05
- 앱 구조화 데이터: 2024.08~2026.05 분기별 라인업, 2026.05 기준 118개 상세 모델
- 보기 방식: 집중 보기(기본), 상세 페이지
- 분기 선택: 2024.08부터 2026.05까지 선택한 분기의 포커스형 라인업을 표시합니다.
- 변화 필터: 신규, 유지, 복귀, 제외, 연속 라인을 분리해서 볼 수 있습니다.
- 상세 페이지: `#/shoe/{id}`
- 상세 페이지에는 같은 브랜드·종류 셀 기준의 분기별 라인 등장 이력을 표시합니다.
- 분기별 이력은 원문 추천표를 브랜드와 용도 기준으로 다시 정리한 앱 구조화 데이터입니다.
- 사진: 브랜드 공식 사이트, 공식 CDN, 공식 뉴스룸 출처 URL을 기본으로 사용합니다. `Adizero Prime X Evo`는 공식 페이지에 흰 배경 측면 제품 컷이 없어, 사용자가 제공한 제품 컷을 예외로 사용하며 공식 제품 페이지는 Adidas 링크로 유지합니다.
- 배포용 사진: `assets/shoes-original-safe/000.*`~`120.*`
  - 브랜드 공식 사이트·CDN에서 확보한 원본을 배경 제거와 재인코딩 없이 그대로 보관합니다.
  - 한글 파일명 정규화 차이로 배포 환경에서 404가 날 수 있어, 화면에서는 번호 기반 ASCII 파일만 참조합니다.
  - `assets/shoes/`는 원본 보관용이며 `scripts/create-official-image-assets.py`가 현재 데이터 순서에 맞춰 배포용 경로로 원본 파일을 복사합니다.
- 가격 확인은 자동 최저가가 아니라 네이버·쿠팡 검색 링크로 제공합니다.
- 특정 판매처, 정품 여부, 최저가를 보증하지 않습니다. 구매 전 각 플랫폼에서 색상, 사이즈, 배송비, 판매처를 직접 확인해야 합니다.
- 가격 스냅샷/API 수집 코드는 다음 단계 검토용으로 보존하지만 현재 사용자 화면에서는 로드하지 않습니다.
- 토스쇼핑은 안정적인 공개 웹 검색 URL이 확인되면 연결합니다.

## Vercel + Supabase

GitHub, Vercel, Supabase의 역할은 겹치지 않게 분리합니다.

- GitHub: 소스 저장소, PR, 이력 관리
- Vercel: 정적 앱 배포, `/api/bootstrap` 서버리스 API, 향후 cron
- Supabase: 구조화 라인업 DB, 향후 사용자/알림 데이터

필요 환경변수:

```sh
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_TABLE_PREFIX=runfit_
# REST seed 실행 시에만 필요
SUPABASE_SERVICE_ROLE_KEY=...
```

배포 상태 확인:

```sh
curl https://<vercel-domain>/api/health
curl https://<vercel-domain>/api/health?strict=1
```

Supabase 초기화:

```sh
# Supabase SQL editor 또는 CLI에서 실행
supabase/migrations/0001_initial.sql

# 현재 정적 데이터를 seed SQL로 생성
node scripts/export-supabase-seed.mjs > supabase/seed.sql

# Supabase REST로 seed 직접 주입
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_TABLE_PREFIX=runfit_ node scripts/seed-supabase-rest.mjs
```

Vercel 검증:

```sh
PRODUCTION_URL=https://runfit-lineup.vercel.app node scripts/verify-production.mjs
```

## 가격 스냅샷 설정

가격 스냅샷 수집은 현재 사용자 화면에서 사용하지 않습니다. 필요 시 수동 검토용으로만 실행합니다.

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
node --check runtime-data.js
node --check api/bootstrap.js
node --check api/health.js
node --check lib/bootstrap-data.js
node --check data/shoes.js
node --check data/lineup-history.js
node --check data/price-queries.js
node --check data/prices/latest.js
node --check scripts/collect-prices.mjs
node --check scripts/audit-lineup-history.mjs
node --check scripts/audit-prices.mjs
node --check scripts/export-supabase-seed.mjs
node --check scripts/seed-supabase-rest.mjs
node --check scripts/serve-vercel-like.mjs
node --check scripts/verify-production.mjs
node scripts/audit-lineup-history.mjs
node scripts/audit-images.mjs
python3 scripts/audit-official-image-assets.py
node scripts/audit-prices.mjs
```
