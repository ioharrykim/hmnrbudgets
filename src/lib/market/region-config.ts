export interface MarketRegionConfig {
  id: string;
  slug: string;
  regionName: string;
  lifestyleLabel: string;
  commuteLabel: string;
  notes: string;
  lawdCodes: string[];
}

export const marketRegionConfigs: MarketRegionConfig[] = [
  {
    id: "market_seoul_core",
    slug: "seoul-core",
    regionName: "서울 핵심 생활권",
    lifestyleLabel: "마포·성동·광진·영등포",
    commuteLabel: "서울 업무지구 접근 우수",
    notes: "서울 도심 접근성이 높은 핵심 실거주권",
    lawdCodes: ["11440", "11200", "11215", "11560"],
  },
  {
    id: "market_seoul_outer",
    slug: "seoul-outer",
    regionName: "서울 외곽 실거주권",
    lifestyleLabel: "은평·노원·강서·구로",
    commuteLabel: "서울 내 통근 가능, 예산 방어력 양호",
    notes: "서울 안에서 예산 방어가 상대적으로 가능한 생활권",
    lawdCodes: ["11380", "11350", "11500", "11530"],
  },
  {
    id: "market_gwangmyeong_anyang",
    slug: "gwangmyeong-anyang",
    regionName: "광명·안양",
    lifestyleLabel: "광명 철산·안양 평촌권",
    commuteLabel: "여의도·강남 양방향 접근 균형",
    notes: "서울 서남권 인접 경기 생활권",
    lawdCodes: ["41210", "41171", "41173"],
  },
  {
    id: "market_bundang_pangyo",
    slug: "bundang-pangyo",
    regionName: "분당·판교 인접권",
    lifestyleLabel: "분당·판교·정자",
    commuteLabel: "테크 직장 접근성 우수",
    notes: "성남 분당권 고선호 실거주권",
    lawdCodes: ["41135"],
  },
  {
    id: "market_hanam_guri",
    slug: "hanam-guri",
    regionName: "하남·구리",
    lifestyleLabel: "미사·덕풍·갈매권",
    commuteLabel: "강동·잠실 접근성 우수",
    notes: "동부권 인접 경기 생활권",
    lawdCodes: ["41450", "41310"],
  },
  {
    id: "market_goyang_bucheon",
    slug: "goyang-bucheon",
    regionName: "고양·부천",
    lifestyleLabel: "일산·덕양·상동권",
    commuteLabel: "서울 서북권·여의도 접근형",
    notes: "서북권/서부권 인접 경기 생활권",
    lawdCodes: ["41281", "41285", "41287", "41190"],
  },
];
