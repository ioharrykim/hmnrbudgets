import { XMLParser } from "fast-xml-parser";

import { DEFAULT_DATE } from "@/lib/constants";
import type { MarketSnapshot, RefreshReview, SourceRecord } from "@/lib/types";
import { marketRegionConfigs, type MarketRegionConfig } from "@/lib/market/region-config";
import { clamp, makeId, roundTo } from "@/lib/utils";

export interface ApartmentTradeRecord {
  lawdCode: string;
  dealYmd: string;
  apartmentName: string;
  amountKrw: number;
  exclusiveAreaM2: number;
  floor: number;
  builtYear?: number;
}

type PeriodTrades = {
  basisTrades: ApartmentTradeRecord[];
  previousTrades: ApartmentTradeRecord[];
  yoyTrades: ApartmentTradeRecord[];
  publishedMonth: string;
  freshness: MarketSnapshot["freshness"];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

function addMonthsToYmd(ymd: string, offset: number) {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function basisCandidateMonths(basisDate = DEFAULT_DATE) {
  const [year, month] = basisDate.split("-").map(Number);
  const currentMonth = `${year}${String(month).padStart(2, "0")}`;
  const previousMonth = addMonthsToYmd(currentMonth, -1);
  const previousTwoMonth = addMonthsToYmd(currentMonth, -2);

  return {
    currentMonth,
    previousMonth,
    previousTwoMonth,
  };
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parseTradeAmount(raw: string | number | undefined) {
  if (raw === undefined) {
    return 0;
  }

  return Number(String(raw).replace(/[^\d.]/g, "")) * 10_000;
}

function parseFloatLike(raw: string | number | undefined) {
  if (raw === undefined) {
    return 0;
  }

  return Number(String(raw).replace(/[^\d.]/g, ""));
}

export function parseMolitTradeResponse(xml: string, lawdCode: string, dealYmd: string): ApartmentTradeRecord[] {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const body = (parsed.response as { body?: { items?: { item?: unknown } } } | undefined)?.body;
  const items = toArray((body?.items as { item?: unknown } | undefined)?.item as Record<string, unknown>[]);

  return items
    .map((item) => {
      const amountKrw = parseTradeAmount((item.dealAmount ?? item["거래금액"]) as string | number | undefined);

      return {
        lawdCode,
        dealYmd,
        apartmentName: String(item.apartment ?? item["아파트"] ?? "미상"),
        amountKrw,
        exclusiveAreaM2: parseFloatLike(
          (item.excluUseAr ?? item.areaForExclusiveUse ?? item["전용면적"]) as string | number | undefined,
        ),
        floor: parseFloatLike((item.floor ?? item["층"]) as string | number | undefined),
        builtYear: parseFloatLike((item.buildYear ?? item["건축년도"]) as string | number | undefined),
      } satisfies ApartmentTradeRecord;
    })
    .filter((trade) => trade.amountKrw > 0 && trade.exclusiveAreaM2 >= 50);
}

async function fetchMolitTradeMonth(lawdCode: string, dealYmd: string) {
  const serviceKey = process.env.OPEN_DATA_API_KEY;
  if (!serviceKey) {
    return [];
  }

  const baseUrl =
    process.env.MOLIT_APT_TRADE_ENDPOINT ??
    "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
  const pageSize = 999;
  const records: ApartmentTradeRecord[] = [];
  let pageNo = 1;
  let keepFetching = true;

  while (keepFetching) {
    const url = new URL(baseUrl);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("LAWD_CD", lawdCode);
    url.searchParams.set("DEAL_YMD", dealYmd);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(pageSize));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/xml,text/xml",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`MOLIT API request failed: ${response.status}`);
    }

    const xml = await response.text();
    const pageRecords = parseMolitTradeResponse(xml, lawdCode, dealYmd);
    records.push(...pageRecords);

    keepFetching = pageRecords.length === pageSize;
    pageNo += 1;
  }

  return records;
}

async function fetchRegionTradesForMonth(region: MarketRegionConfig, dealYmd: string) {
  const chunks = await Promise.all(region.lawdCodes.map((lawdCode) => fetchMolitTradeMonth(lawdCode, dealYmd)));
  return chunks.flat();
}

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function safePctChange(current: number, previous: number) {
  if (current <= 0 || previous <= 0) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

async function fetchPeriodTrades(region: MarketRegionConfig, basisDate = DEFAULT_DATE): Promise<PeriodTrades> {
  const { previousMonth, previousTwoMonth } = basisCandidateMonths(basisDate);

  let basisTrades = await fetchRegionTradesForMonth(region, previousMonth);
  let publishedMonth = previousMonth;
  let freshness: MarketSnapshot["freshness"] = "fresh";

  if (basisTrades.length < 5) {
    basisTrades = await fetchRegionTradesForMonth(region, previousTwoMonth);
    publishedMonth = previousTwoMonth;
    freshness = basisTrades.length >= 5 ? "pending" : "stale";
  }

  const previousTrades = await fetchRegionTradesForMonth(region, addMonthsToYmd(publishedMonth, -1));
  const yoyTrades = await fetchRegionTradesForMonth(region, addMonthsToYmd(publishedMonth, -12));

  return {
    basisTrades,
    previousTrades,
    yoyTrades,
    publishedMonth: `${publishedMonth.slice(0, 4)}-${publishedMonth.slice(4, 6)}`,
    freshness,
  };
}

function buildMarketSnapshot(
  region: MarketRegionConfig,
  periodTrades: PeriodTrades,
  retrievedAt: string,
): MarketSnapshot {
  const basisAmounts = periodTrades.basisTrades.map((trade) => trade.amountKrw);
  const previousAmounts = periodTrades.previousTrades.map((trade) => trade.amountKrw);
  const yoyAmounts = periodTrades.yoyTrades.map((trade) => trade.amountKrw);

  const priceBandLow = roundTo(percentile(basisAmounts, 0.25), 1_000_000);
  const priceBandMid = roundTo(percentile(basisAmounts, 0.5), 1_000_000);
  const priceBandHigh = roundTo(percentile(basisAmounts, 0.75), 1_000_000);

  const momChangePct = clamp(safePctChange(priceBandMid, percentile(previousAmounts, 0.5)), -40, 40);
  const yoyChangePct = clamp(safePctChange(priceBandMid, percentile(yoyAmounts, 0.5)), -50, 50);

  const sourceRecord: SourceRecord = {
    id: makeId("source"),
    slug: `molit-apt-trades-${region.slug}-${periodTrades.publishedMonth.replace("-", "")}`,
    title: "국토교통부 아파트매매 실거래 상세자료 OpenAPI",
    publisher: "국토교통부 / 공공데이터포털",
    url: "https://www.data.go.kr/data/15126468/openapi.do",
    retrievedAt,
    publishedAt: `${periodTrades.publishedMonth}-01`,
    notes: `${region.regionName} ${periodTrades.publishedMonth} 거래 ${periodTrades.basisTrades.length}건 기반 정규화`,
  };

  return {
    id: region.id,
    slug: region.slug,
    regionName: region.regionName,
    lifestyleLabel: region.lifestyleLabel,
    publishedMonth: periodTrades.publishedMonth,
    reviewStatus: "reviewed",
    freshness: periodTrades.freshness,
    priceBandLow,
    priceBandMid,
    priceBandHigh,
    momChangePct: roundTo(momChangePct * 10, 1) / 10,
    yoyChangePct: roundTo(yoyChangePct * 10, 1) / 10,
    commuteLabel: region.commuteLabel,
    notes:
      periodTrades.freshness === "fresh"
        ? `${region.notes}. 최근 공식 실거래월 기준으로 계산했습니다.`
        : periodTrades.freshness === "pending"
          ? `${region.notes}. 직전 월 거래가 부족해 이전 월 공식 거래로 대체했습니다.`
          : `${region.notes}. 최신 공식 거래가 부족해 stale 상태입니다.`,
    sourceRecords: [sourceRecord],
  };
}

export async function refreshMarketSnapshotsFromMolit(basisDate = DEFAULT_DATE): Promise<{
  markets: MarketSnapshot[];
  reviews: RefreshReview[];
}> {
  const retrievedAt = new Date().toISOString();
  const snapshots = await Promise.all(
    marketRegionConfigs.map(async (region) => buildMarketSnapshot(region, await fetchPeriodTrades(region, basisDate), retrievedAt)),
  );

  return {
    markets: snapshots,
    reviews: snapshots.map((market) => ({
      id: makeId("review"),
      sourceRecordId: market.sourceRecords[0]!.id,
      entityType: "market_snapshot",
      entityId: market.id,
      status: "reviewed",
      reviewedBy: "molit-openapi-refresh",
      reviewedAt: retrievedAt,
      notes:
        market.freshness === "fresh"
          ? `${market.publishedMonth} 기준 공식 거래 정규화 완료`
          : `${market.publishedMonth} 기준 대체 데이터 사용 (${market.freshness})`,
    })),
  };
}
