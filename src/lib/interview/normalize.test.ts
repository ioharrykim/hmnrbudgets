import { normalizeInterviewAnswers } from "@/lib/interview/normalize";
import { parseKoreanMoney } from "@/lib/parsing";
import type { InterviewAnswer } from "@/lib/types";

describe("parseKoreanMoney", () => {
  it("supports Korean units", () => {
    expect(parseKoreanMoney("1.8억")).toBe(180_000_000);
    expect(parseKoreanMoney("450만원")).toBe(4_500_000);
    expect(parseKoreanMoney("3억2천")).toBe(320_000_000);
  });
});

describe("normalizeInterviewAnswers", () => {
  it("builds structured snapshot and goal from interview answers", () => {
    const answers: InterviewAnswer[] = [
      { questionId: "hyunminMonthlyNetIncome", answer: "450만원" },
      { questionId: "hyunminMonthlyVariableIncome", answer: "20만원" },
      { questionId: "nuriMonthlyNetIncome", answer: "330만원" },
      { questionId: "nuriMonthlyVariableIncome", answer: "10만원" },
      { questionId: "monthlyFixedExpenses", answer: "260만원" },
      { questionId: "monthlyCurrentHousingCost", answer: "85만원" },
      { questionId: "currentMonthlySavings", answer: "240만원" },
      { questionId: "cashAssets", answer: "1.6억" },
      { questionId: "subscriptionSavings", answer: "1800만원" },
      { questionId: "jeonseReturnAmount", answer: "7000만원" },
      { questionId: "outstandingDebt", answer: "0" },
      { questionId: "otherDebtMonthlyService", answer: "0" },
      { questionId: "expectedAnnualBonus", answer: "1000만원" },
      { questionId: "preferredRegions", answer: "광명, 마포" },
      { questionId: "commuteMaxMinutes", answer: "60" },
      { questionId: "targetTimeframeMonths", answer: "48" },
    ];

    const draft = normalizeInterviewAnswers("household_fixture", answers);

    expect(draft.financialSnapshot.members[0]?.monthlyNetIncome).toBe(4_500_000);
    expect(draft.financialSnapshot.cashAssets).toBe(160_000_000);
    expect(draft.housingGoal.preferredRegions).toEqual(["광명", "마포"]);
    expect(draft.missingFields).toHaveLength(0);
  });

  it("reports missing fields when the interview is incomplete", () => {
    const draft = normalizeInterviewAnswers("household_fixture", [
      { questionId: "hyunminMonthlyNetIncome", answer: "450만원" },
    ]);

    expect(draft.missingFields.length).toBeGreaterThan(0);
  });
});
