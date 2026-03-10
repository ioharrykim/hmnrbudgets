import { computeAffordabilityRun } from "@/lib/finance/affordability";
import { promotedMarketSnapshots } from "@/lib/market/market-seed";
import { basePolicySnapshot } from "@/lib/policy/policy-seed";
import type { DashboardPayload, FinancialSnapshot, Household, HousingGoal } from "@/lib/types";

export function buildHouseholdFixture(): Household {
  return {
    id: "household_fixture",
    email: "hmnr@example.com",
    slug: "hmnr",
    displayName: "현민 · 누리",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    storageMode: "demo-cookie",
    targetMarketArea: "capital-area",
    audienceMode: "household-first",
  };
}

export function buildFinancialSnapshotFixture(householdId = "household_fixture"): FinancialSnapshot {
  return {
    id: "financial_fixture",
    householdId,
    capturedAt: "2026-03-10T00:00:00.000Z",
    members: [
      {
        id: "member_hyunmin",
        householdId,
        name: "현민",
        roleLabel: "본인",
        monthlyNetIncome: 3_700_000,
        monthlyVariableIncome: 200_000,
        employmentType: "employee",
      },
      {
        id: "member_nuri",
        householdId,
        name: "누리",
        roleLabel: "배우자",
        monthlyNetIncome: 2_800_000,
        monthlyVariableIncome: 100_000,
        employmentType: "employee",
      },
    ],
    monthlyFixedExpenses: 2_900_000,
    monthlyCurrentHousingCost: 1_100_000,
    currentMonthlySavings: 2_300_000,
    cashAssets: 160_000_000,
    subscriptionSavings: 18_000_000,
    jeonseReturnAmount: 70_000_000,
    otherInvestableAssets: 0,
    outstandingDebt: 20_000_000,
    otherDebtMonthlyService: 250_000,
    expectedAnnualBonus: 4_000_000,
  };
}

export function buildHousingGoalFixture(householdId = "household_fixture"): HousingGoal {
  return {
    id: "goal_fixture",
    householdId,
    capturedAt: "2026-03-10T00:00:00.000Z",
    preferredRegions: ["광명", "마포", "분당"],
    targetTimeframeMonths: 48,
    commuteMaxMinutes: 60,
    minimumExclusiveAreaM2: 59,
    priorities: ["현금흐름 안정", "출퇴근 균형", "3~5년 내 매수"],
  };
}

export function buildDashboardFixture(withRun = false): DashboardPayload {
  const household = buildHouseholdFixture();
  const financialSnapshot = buildFinancialSnapshotFixture(household.id);
  const housingGoal = buildHousingGoalFixture(household.id);
  const latestRun = withRun
    ? computeAffordabilityRun(
        household.id,
        financialSnapshot,
        housingGoal,
        basePolicySnapshot,
        promotedMarketSnapshots,
        {
          summary: "광명·안양 기준으로 4년 내 매수 준비가 가능합니다.",
          risks: ["보수 시나리오에서는 기간이 늘어날 수 있습니다.", "기존 부채는 DSR 여력을 일부 사용합니다.", "서울 핵심권은 아직 자금 격차가 큽니다."],
          recommendedActions: ["월 저축액 유지", "전세보증금 반환 시점 점검", "광명·안양 실거래 추적"],
          followUpQuestions: ["보너스 변동성은 어느 정도인가요?", "생활권을 얼마나 넓힐 수 있나요?"],
          provider: "template",
        },
      )
    : null;

  return {
    household,
    financialSnapshot: withRun ? financialSnapshot : null,
    housingGoal: withRun ? housingGoal : null,
    latestPolicySnapshot: basePolicySnapshot,
    promotedMarkets: promotedMarketSnapshots,
    latestRun,
  };
}
