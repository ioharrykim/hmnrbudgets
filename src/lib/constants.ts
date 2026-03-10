export const APP_NAME = "현민·누리 홈바이 플래너";

export const DEFAULT_DATE = "2026-03-10";
export const DEFAULT_HOUSEHOLD_NAME = "현민 · 누리";
export const DEFAULT_HOUSEHOLD_EMAIL = "hmnr@example.com";
export const DEMO_SESSION_COOKIE = "hmnr-demo-session";

export const INTERVIEW_HINTS = [
  "금액은 `450만원`, `1.8억`, `320000000` 형식 모두 입력 가능합니다.",
  "생활비는 주거비를 제외한 월 고정지출 기준으로 적어주세요.",
  "희망 생활권은 `마포, 광명, 성남`처럼 쉼표로 여러 개 적어도 됩니다.",
];

export const HOUSEHOLD_ROLES = [
  { name: "현민", roleLabel: "본인" },
  { name: "누리", roleLabel: "배우자" },
] as const;

export const OFFICIAL_SOURCE_LINKS = [
  { label: "한국주택금융공사", url: "https://www.hf.go.kr/ko/index.do" },
  { label: "주택도시기금 기금e든든", url: "https://enhuf.molit.go.kr/" },
  { label: "금융위원회", url: "https://www.fsc.go.kr/" },
  { label: "한국부동산원 R-ONE", url: "https://www.reb.or.kr/r-one/" },
  { label: "공공데이터포털", url: "https://www.data.go.kr/" },
] as const;
