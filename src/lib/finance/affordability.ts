import type {
  ActionPlan,
  ActionPlanItem,
  AffordabilityRun,
  FinancialSnapshot,
  HousingGoal,
  MarketSnapshot,
  MarketSuitabilityRecord,
  PolicyLoanEligibility,
  PolicySnapshot,
  ScenarioKey,
  ScenarioResult,
  SourceRecord,
} from "@/lib/types";
import { makeId, roundTo } from "@/lib/utils";
import {
  calculateRecognizedMonthlyIncome,
  calculateTotalOwnFunds,
  evaluatePolicyEligibility,
} from "@/lib/policy/policy-rules";

function presentValueFromMonthlyPayment(monthlyPayment: number, annualRate: number, years: number) {
  const monthlyRate = annualRate / 12;
  const periods = years * 12;

  if (monthlyRate === 0) {
    return monthlyPayment * periods;
  }

  return (monthlyPayment * (1 - Math.pow(1 + monthlyRate, -periods))) / monthlyRate;
}

function estimateMonthlySavings(financialSnapshot: FinancialSnapshot) {
  const recognizedMonthlyIncome = calculateRecognizedMonthlyIncome(financialSnapshot);
  const emergencyBuffer = recognizedMonthlyIncome * 0.15;
  const budgetByIncome = recognizedMonthlyIncome * 0.3;
  const budgetByExpenses = Math.max(
    recognizedMonthlyIncome -
      financialSnapshot.monthlyFixedExpenses -
      financialSnapshot.otherDebtMonthlyService -
      emergencyBuffer,
    0,
  );
  const demonstratedCapacity = Math.max(
    financialSnapshot.monthlyCurrentHousingCost +
      financialSnapshot.currentMonthlySavings -
      financialSnapshot.otherDebtMonthlyService,
    0,
  );

  const safeMonthlyHousingBudget = Math.min(
    budgetByIncome,
    Math.max(Math.min(demonstratedCapacity * 1.05, budgetByExpenses), 0),
  );

  return {
    recognizedMonthlyIncome,
    safeMonthlyHousingBudget: roundTo(safeMonthlyHousingBudget, 10_000),
  };
}

function estimateGeneralLoanCapacity(
  financialSnapshot: FinancialSnapshot,
  policySnapshot: PolicySnapshot,
  safeMonthlyHousingBudget: number,
) {
  const annualRecognizedIncome = calculateRecognizedMonthlyIncome(financialSnapshot) * 12;
  const annualDebtServiceCap = Math.max(
    annualRecognizedIncome * policySnapshot.generalDsrLimit -
      financialSnapshot.otherDebtMonthlyService * 12,
    0,
  );
  const monthlyDebtServiceCap = annualDebtServiceCap / 12;
  const cashflowCapacity = presentValueFromMonthlyPayment(
    safeMonthlyHousingBudget,
    policySnapshot.assumedGeneralMortgageRate,
    30,
  );
  const dsrCapacity = presentValueFromMonthlyPayment(
    monthlyDebtServiceCap,
    policySnapshot.assumedGeneralMortgageRate + policySnapshot.capitalAreaStressDsrRate,
    30,
  );

  return roundTo(Math.min(cashflowCapacity, dsrCapacity), 1_000_000);
}

function estimatePurchasePriceLimit(
  ownFunds: number,
  loanCapacity: number,
  ltvLimit: number,
  closingCostRate: number,
) {
  const byCash = (ownFunds + loanCapacity) / (1 + closingCostRate);
  const byLtv = loanCapacity / ltvLimit;
  return roundTo(Math.max(Math.min(byCash, byLtv), 0), 1_000_000);
}

function estimateRequiredCash(price: number, closingCostRate: number, loanAmount: number) {
  return roundTo(Math.max(price * (1 + closingCostRate) - loanAmount, 0), 1_000_000);
}

function estimateProjectedCashAtGoal(
  financialSnapshot: FinancialSnapshot,
  targetMonths: number,
  savingsMultiplier: number,
) {
  const ownFunds = calculateTotalOwnFunds(financialSnapshot);
  const monthlySavings = financialSnapshot.currentMonthlySavings * savingsMultiplier;
  const annualBonus = financialSnapshot.expectedAnnualBonus * 0.7;
  return ownFunds + monthlySavings * targetMonths + (annualBonus / 12) * targetMonths;
}

function classifySuitability(cashGap: number, monthsToGap: number): MarketSuitabilityRecord["suitability"] {
  if (cashGap <= 0) {
    return "affordable";
  }

  if (monthsToGap <= 24) {
    return "stretch";
  }

  return "longshot";
}

function buildMarketSuitability(
  financialSnapshot: FinancialSnapshot,
  housingGoal: HousingGoal,
  policySnapshot: PolicySnapshot,
  ownFunds: number,
  loanCapacity: number,
  markets: MarketSnapshot[],
) {
  const targetMonths = housingGoal.targetTimeframeMonths;
  const projectedCash = estimateProjectedCashAtGoal(financialSnapshot, targetMonths, 1);

  return markets.map((market) => {
    const requiredCash = estimateRequiredCash(
      market.priceBandMid,
      policySnapshot.closingCostRate,
      Math.min(loanCapacity, market.priceBandMid * 0.7),
    );
    const cashGap = roundTo(requiredCash - projectedCash, 1_000_000);
    const additionalPerMonth = cashGap > 0 ? cashGap / targetMonths : 0;
    const estimatedMonthsToCloseGap =
      additionalPerMonth <= 0
        ? 0
        : Math.ceil(
            cashGap /
              Math.max(financialSnapshot.currentMonthlySavings * 0.85 + financialSnapshot.monthlyCurrentHousingCost * 0.3, 1),
          );

    const suitability = classifySuitability(cashGap, estimatedMonthsToCloseGap);
    const commutePenalty =
      housingGoal.preferredRegions.some((region) => market.regionName.includes(region) || market.lifestyleLabel.includes(region))
        ? ""
        : "생활권 선호와 조금 떨어질 수 있습니다. ";

    return {
      marketSnapshotId: market.id,
      regionName: market.regionName,
      targetPrice: market.priceBandMid,
      requiredCash,
      projectedCashAtGoal: projectedCash,
      cashGap,
      estimatedMonthsToCloseGap,
      suitability,
      narrative:
        cashGap <= 0
          ? `${commutePenalty}현재 목표 시점 안에서 접근 가능한 수준입니다.`
          : `${commutePenalty}목표 시점까지 약 ${roundTo(additionalPerMonth, 10_000).toLocaleString("ko-KR")}원씩 추가 적립이 필요합니다.`,
    } satisfies MarketSuitabilityRecord;
  });
}

function buildScenario(
  scenario: ScenarioKey,
  targetMarket: MarketSnapshot,
  financialSnapshot: FinancialSnapshot,
  housingGoal: HousingGoal,
  policySnapshot: PolicySnapshot,
  loanCapacity: number,
  ownFunds: number,
): ScenarioResult {
  const adjustments = {
    conservative: { price: targetMarket.priceBandHigh, savings: 0.85, rateAddon: 0.003 },
    base: { price: targetMarket.priceBandMid, savings: 1, rateAddon: 0 },
    optimistic: { price: targetMarket.priceBandLow, savings: 1.15, rateAddon: -0.002 },
  }[scenario];

  const adjustedLoan = estimateGeneralLoanCapacity(
    financialSnapshot,
    {
      ...policySnapshot,
      assumedGeneralMortgageRate: Math.max(policySnapshot.assumedGeneralMortgageRate + adjustments.rateAddon, 0.03),
    },
    estimateMonthlySavings(financialSnapshot).safeMonthlyHousingBudget * adjustments.savings,
  );
  const safeMaxPurchasePrice = estimatePurchasePriceLimit(
    ownFunds,
    adjustedLoan,
    0.7,
    policySnapshot.closingCostRate,
  );
  const totalRequiredCash = estimateRequiredCash(
    adjustments.price,
    policySnapshot.closingCostRate,
    Math.min(adjustedLoan, adjustments.price * 0.7),
  );
  const futureCash = estimateProjectedCashAtGoal(
    financialSnapshot,
    housingGoal.targetTimeframeMonths,
    adjustments.savings,
  );
  const cashGap = Math.max(totalRequiredCash - futureCash, 0);
  const monthsToGoal =
    cashGap <= 0
      ? 0
      : Math.ceil(cashGap / Math.max(financialSnapshot.currentMonthlySavings * adjustments.savings, 1));

  return {
    scenario,
    safeMaxPurchasePrice,
    totalRequiredCash,
    requiredSelfFunding: roundTo(totalRequiredCash, 1_000_000),
    generalLoanCapacity: adjustedLoan,
    targetRegion: targetMarket.regionName,
    targetRegionMidPrice: adjustments.price,
    monthsToGoal,
    additionalMonthlySavingsNeeded:
      cashGap <= 0 ? 0 : roundTo(cashGap / Math.max(housingGoal.targetTimeframeMonths, 1), 10_000),
  };
}

function buildActionPlan(
  householdId: string,
  policyEligibility: PolicyLoanEligibility[],
  marketSuitability: MarketSuitabilityRecord[],
  scenarios: Record<ScenarioKey, ScenarioResult>,
): ActionPlan {
  const bestMarket = marketSuitability[0];
  const didimdol = policyEligibility.find((item) => item.product === "didimdol");
  const items: ActionPlanItem[] = [
    {
      id: makeId("action"),
      horizon: "now",
      title: "현재 재무 베이스라인 고정",
      detail: "월 저축액과 고정지출을 3개월 연속 추적해 계산식의 입력 오차를 줄입니다.",
    },
    {
      id: makeId("action"),
      horizon: "quarter",
      title: didimdol?.eligible ? "신혼가구 정책대출 조건 유지" : "정책대출 탈락 요인 보완",
      detail: didimdol?.eligible
        ? "신혼가구 요건, 무주택 상태, 순자산 기준을 유지하면서 디딤돌 한도를 우선 검토합니다."
        : "정책대출이 막히는 항목을 해소하지 못하면 일반 주담대 의존도가 커집니다.",
    },
    {
      id: makeId("action"),
      horizon: "year",
      title: `${bestMarket?.regionName ?? "우선 후보지"} 기준 현금 격차 닫기`,
      detail:
        bestMarket?.cashGap && bestMarket.cashGap > 0
          ? `목표 시점 기준 약 ${Math.round(bestMarket.cashGap / 10_000).toLocaleString("ko-KR")}만원의 자기자금 격차가 남아 추가 적립 또는 예산 재조정이 필요합니다.`
          : "목표 시점 안에서 자기자금 요건을 충족할 가능성이 높아 실거주 매물을 좁혀갈 수 있습니다.",
    },
  ];

  if (scenarios.conservative.monthsToGoal > 24) {
    items.push({
      id: makeId("action"),
      horizon: "year",
      title: "보수 시나리오 대비 방어선 확보",
      detail: "보수 시나리오가 24개월 이상 밀리므로 희망 지역을 1단계 아래 밴드까지 함께 비교합니다.",
    });
  }

  return {
    id: makeId("plan"),
    householdId,
    createdAt: new Date().toISOString(),
    items,
  };
}

export function computeAffordabilityRun(
  householdId: string,
  financialSnapshot: FinancialSnapshot,
  housingGoal: HousingGoal,
  policySnapshot: PolicySnapshot,
  markets: MarketSnapshot[],
  aiInsight: AffordabilityRun["aiInsight"],
): AffordabilityRun {
  const { recognizedMonthlyIncome, safeMonthlyHousingBudget } = estimateMonthlySavings(financialSnapshot);
  const ownFunds = calculateTotalOwnFunds(financialSnapshot);
  const loanCapacity = estimateGeneralLoanCapacity(
    financialSnapshot,
    policySnapshot,
    safeMonthlyHousingBudget,
  );
  const policyEligibility = evaluatePolicyEligibility(financialSnapshot, policySnapshot, markets);
  const sortedMarkets = [...markets].sort((a, b) => a.priceBandMid - b.priceBandMid);
  const marketSuitability = buildMarketSuitability(
    financialSnapshot,
    housingGoal,
    policySnapshot,
    ownFunds,
    loanCapacity,
    sortedMarkets,
  ).sort((a, b) => a.cashGap - b.cashGap);

  const recommendedMarketSnapshot =
    sortedMarkets.find((market) => market.id === marketSuitability[0]?.marketSnapshotId) ?? sortedMarkets[0];
  const scenarios: Record<ScenarioKey, ScenarioResult> = {
    conservative: buildScenario(
      "conservative",
      recommendedMarketSnapshot,
      financialSnapshot,
      housingGoal,
      policySnapshot,
      loanCapacity,
      ownFunds,
    ),
    base: buildScenario(
      "base",
      recommendedMarketSnapshot,
      financialSnapshot,
      housingGoal,
      policySnapshot,
      loanCapacity,
      ownFunds,
    ),
    optimistic: buildScenario(
      "optimistic",
      recommendedMarketSnapshot,
      financialSnapshot,
      housingGoal,
      policySnapshot,
      loanCapacity,
      ownFunds,
    ),
  };

  const actionPlan = buildActionPlan(householdId, policyEligibility, marketSuitability, scenarios);
  const sources = new Map<string, SourceRecord>();
  policySnapshot.sources.forEach((source) => sources.set(source.id, source));
  sortedMarkets.forEach((market) => {
    market.sourceRecords.forEach((source) => sources.set(source.id, source));
  });

  return {
    id: makeId("run"),
    householdId,
    computedAt: new Date().toISOString(),
    basisDate: policySnapshot.basisDate,
    policySnapshotId: policySnapshot.id,
    marketSnapshotIds: sortedMarkets.map((market) => market.id),
    recognizedMonthlyIncome,
    safeMonthlyHousingBudget,
    totalAvailableOwnFunds: ownFunds,
    policyEligibility,
    recommendedMarket: marketSuitability[0] ?? null,
    marketSuitability,
    scenarios,
    actionPlan,
    aiInsight,
    sourceRecords: [...sources.values()],
  };
}
