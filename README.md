# 현민·누리 홈바이 플래너

서울과 인접 경기권 아파트 매수를 목표로 하는 신혼부부용 재정 플래너 MVP입니다. 인터뷰형 입력, 구조화된 재무 스냅샷, 정책대출 판정, 지역별 매수 가능 시점 계산, AI 요약을 한 흐름으로 묶었습니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPEN_DATA_API_KEY`
- `MOLIT_APT_TRADE_ENDPOINT`

값이 없으면 앱은 demo cookie + in-memory 저장소로 동작합니다. Supabase 값을 넣으면 Postgres 저장소를 사용합니다.
`OPEN_DATA_API_KEY`를 넣으면 `국토교통부 아파트매매 실거래 상세자료 OpenAPI` 기준으로 시장 밴드를 새로 계산합니다.

## 포함된 기능

- 대화형 인터뷰에서 재무 데이터 수집
- 구조화 폼으로 숫자 수정
- 2026-03-10 기준 정책 로직
  - 보금자리론
  - 디딤돌 / 신혼가구 구입자금
  - 수도권 3단계 스트레스 DSR 반영
- 서울 + 인접 경기권 아파트 밴드 비교
- `언제 살 수 있나 / 얼마가 필요하나 / 어떻게 준비하나` 대시보드
- OpenAI 기반 AI 설명 레이어와 템플릿 fallback
- Supabase magic link 인증 경로 (`/auth/callback`)
- `OPEN_DATA_API_KEY` 기반 실거래 refresh 파이프라인

## 배치 스크립트

```bash
npm run refresh:market-policy
npm run promote:snapshots
```

## 테스트

```bash
npm test
```
