import { computeAffordabilityRun } from "@/lib/finance/affordability";
import { promotedMarketSnapshots } from "@/lib/market/market-seed";
import { basePolicySnapshot } from "@/lib/policy/policy-seed";
import { buildFinancialSnapshotFixture, buildHousingGoalFixture } from "@/test/fixtures";

describe("computeAffordabilityRun", () => {
  it("calculates safe purchase price, timeline, and policy eligibility", () => {
    const financialSnapshot = buildFinancialSnapshotFixture();
    const housingGoal = buildHousingGoalFixture();

    const run = computeAffordabilityRun(
      "household_fixture",
      financialSnapshot,
      housingGoal,
      basePolicySnapshot,
      promotedMarketSnapshots,
      {
        summary: "template",
        risks: [],
        recommendedActions: [],
        followUpQuestions: [],
        provider: "template",
      },
    );

    expect(run.safeMonthlyHousingBudget).toBeGreaterThan(2_000_000);
    expect(run.scenarios.base.safeMaxPurchasePrice).toBeGreaterThan(500_000_000);
    expect(run.scenarios.base.generalLoanCapacity).toBeGreaterThan(180_000_000);
    expect(run.policyEligibility).toHaveLength(2);
    expect(run.policyEligibility.find((policy) => policy.product === "didimdol")?.eligible).toBe(true);
    expect(run.marketSuitability[0]?.regionName).toBeDefined();
  });

  it("extends the timeline when debt and expenses are too high", () => {
    const financialSnapshot = buildFinancialSnapshotFixture();
    financialSnapshot.monthlyFixedExpenses = 4_500_000;
    financialSnapshot.currentMonthlySavings = 800_000;
    financialSnapshot.otherDebtMonthlyService = 900_000;

    const run = computeAffordabilityRun(
      "household_fixture",
      financialSnapshot,
      buildHousingGoalFixture(),
      basePolicySnapshot,
      promotedMarketSnapshots,
      {
        summary: "template",
        risks: [],
        recommendedActions: [],
        followUpQuestions: [],
        provider: "template",
      },
    );

    expect(run.scenarios.base.monthsToGoal).toBeGreaterThan(24);
    expect(run.marketSuitability.some((market) => market.suitability === "longshot")).toBe(true);
  });
});
