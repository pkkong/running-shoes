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
- 분기 아카이브: 2024.08, 2024.11, 2025.02, 2025.05, 2025.08, 2025.11, 2026.02, 2026.05
- 상세 페이지: `#/shoe/{id}`
- 사진: 브랜드 공식 사이트, 공식 CDN, 공식 뉴스룸 출처 URL
- 가격 조회, 최저가 검색, 알림 기능은 `priceStatus: "planned"` 상태로 UI 자리만 준비되어 있습니다.

## 검증

```sh
node --check app.js
node --check data/shoes.js
node scripts/audit-images.mjs
```
