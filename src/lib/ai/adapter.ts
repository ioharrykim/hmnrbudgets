import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { formatCompactKrw, formatMonths } from "@/lib/format";
import type { AiInsight, AffordabilityRun, FinancialSnapshot, HousingGoal, MarketSnapshot, PolicySnapshot } from "@/lib/types";

const OPENAI_REQUEST_TIMEOUT_MS = 8_000;

const aiInsightSchema = z.object({
  summary: z.string(),
  risks: z.array(z.string()).min(3).max(5),
  recommendedActions: z.array(z.string()).min(3).max(5),
  followUpQuestions: z.array(z.string()).min(2).max(4),
});

type AiInsightSchema = z.infer<typeof aiInsightSchema>;

function buildTemplateInsight(
  financialSnapshot: FinancialSnapshot,
  housingGoal: HousingGoal,
  run: Pick<AffordabilityRun, "recommendedMarket" | "scenarios" | "policyEligibility" | "safeMonthlyHousingBudget">,
): AiInsight {
  const didimdol = run.policyEligibility.find((item) => item.product === "didimdol");
  const bestScenario = run.scenarios.base;
  const risks = [
    `보수 시나리오 기준 목표까지 ${formatMonths(run.scenarios.conservative.monthsToGoal)}가 더 필요할 수 있습니다.`,
    didimdol?.eligible
      ? "정책대출 요건은 유효하지만 목표 주택가가 6억원을 넘으면 바로 탈락합니다."
      : "정책대출 요건을 벗어나 있어 일반 주담대 의존도가 높습니다.",
    financialSnapshot.outstandingDebt > 0
      ? "기존 부채 상환액이 DSR 여력을 일부 잠식하고 있습니다."
      : "기존 부채 부담은 크지 않지만 자기자금 축적 속도가 핵심 변수입니다.",
  ];

  const recommendedActions = [
    `월 주거비 한도는 약 ${formatCompactKrw(run.safeMonthlyHousingBudget)}원 수준으로 유지하세요.`,
    `우선 검토 지역은 ${run.recommendedMarket?.regionName ?? "후보 지역"}이며, 중간값 매수가는 약 ${formatCompactKrw(bestScenario.targetRegionMidPrice)}입니다.`,
    `목표 시점 ${housingGoal.targetTimeframeMonths}개월 내 달성을 위해 월 ${formatCompactKrw(bestScenario.additionalMonthlySavingsNeeded)}원을 추가 확보하는 안을 점검하세요.`,
  ];

  return {
    summary: `${run.recommendedMarket?.regionName ?? "우선 후보지"}를 기준으로 보면 현재 구조에서는 ${formatMonths(
      bestScenario.monthsToGoal,
    )} 안팎의 준비 기간이 필요합니다.`,
    risks,
    recommendedActions,
    followUpQuestions: [
      "보너스나 성과급의 변동성을 어느 정도 보수적으로 잡을까요?",
      "희망 생활권을 서울 외곽 또는 인접 경기로 넓힐 의향이 있나요?",
      "전세보증금 반환 시점은 매수 목표 시점과 얼마나 맞물리나요?",
    ],
    provider: "template",
  };
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    timeout: OPENAI_REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });
}

export async function generateAiInsight(params: {
  financialSnapshot: FinancialSnapshot;
  housingGoal: HousingGoal;
  policySnapshot: PolicySnapshot;
  markets: MarketSnapshot[];
  preliminaryRun: Pick<AffordabilityRun, "recommendedMarket" | "scenarios" | "policyEligibility" | "safeMonthlyHousingBudget">;
}): Promise<AiInsight> {
  const fallback = buildTemplateInsight(
    params.financialSnapshot,
    params.housingGoal,
    params.preliminaryRun,
  );

  const client = getOpenAIClient();
  if (!client) {
    return fallback;
  }

  try {
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      timeout: OPENAI_REQUEST_TIMEOUT_MS,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content:
            "당신은 한국 신혼부부 주택구입 플래너입니다. 계산 수치를 바꾸지 말고, 주어진 숫자를 바탕으로 요약/리스크/행동만 한국어로 작성하세요.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              financialSnapshot: params.financialSnapshot,
              housingGoal: params.housingGoal,
              policySnapshot: {
                basisDate: params.policySnapshot.basisDate,
                publishedDate: params.policySnapshot.publishedDate,
                bogeumjari: params.policySnapshot.bogeumjari,
                didimdol: params.policySnapshot.didimdol,
              },
              markets: params.markets.map((market) => ({
                regionName: market.regionName,
                low: market.priceBandLow,
                mid: market.priceBandMid,
                high: market.priceBandHigh,
                freshness: market.freshness,
              })),
              preliminaryRun: params.preliminaryRun,
            },
            null,
            2,
          ),
        },
      ],
      text: {
        format: zodTextFormat(aiInsightSchema, "housing_affordability_insight"),
      },
    });

    const parsed = response.output_parsed as AiInsightSchema | null;
    if (!parsed) {
      return fallback;
    }

    return {
      ...parsed,
      provider: "openai",
    };
  } catch {
    return fallback;
  }
}
