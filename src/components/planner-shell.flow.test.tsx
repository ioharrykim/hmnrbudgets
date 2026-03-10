import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlannerShell } from "@/components/planner-shell";
import { interviewQuestions } from "@/lib/interview/questions";
import { normalizeInterviewAnswers } from "@/lib/interview/normalize";
import { computeAffordabilityRun } from "@/lib/finance/affordability";
import { promotedMarketSnapshots } from "@/lib/market/market-seed";
import { basePolicySnapshot } from "@/lib/policy/policy-seed";
import { buildDashboardFixture, buildFinancialSnapshotFixture, buildHousingGoalFixture } from "@/test/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("PlannerShell flow", () => {
  it("walks through interview, saves the draft, and shows dashboard results", async () => {
    const householdId = "household_fixture";
    const initialDashboard = buildDashboardFixture(false);
    const draft = normalizeInterviewAnswers(
      householdId,
      interviewQuestions.map((question) => ({
        questionId: question.id,
        answer:
          {
            hyunminMonthlyNetIncome: "370만원",
            hyunminMonthlyVariableIncome: "20만원",
            nuriMonthlyNetIncome: "280만원",
            nuriMonthlyVariableIncome: "10만원",
            monthlyFixedExpenses: "290만원",
            monthlyCurrentHousingCost: "110만원",
            currentMonthlySavings: "230만원",
            cashAssets: "1.6억",
            subscriptionSavings: "1800만원",
            jeonseReturnAmount: "7000만원",
            outstandingDebt: "2000만원",
            otherDebtMonthlyService: "25만원",
            expectedAnnualBonus: "400만원",
            preferredRegions: "광명, 마포, 분당",
            commuteMaxMinutes: "60",
            targetTimeframeMonths: "48",
          }[question.id] ?? "",
      })),
    );

    const updatedFinancialSnapshot = buildFinancialSnapshotFixture(householdId);
    const updatedHousingGoal = buildHousingGoalFixture(householdId);
    const updatedRun = computeAffordabilityRun(
      householdId,
      updatedFinancialSnapshot,
      updatedHousingGoal,
      basePolicySnapshot,
      promotedMarketSnapshots,
      {
        summary: "광명·안양 기준으로 4년 이내 매수 준비가 가능합니다.",
        risks: ["보수 시나리오에서는 더 오래 걸릴 수 있습니다.", "서울 핵심권은 추가 자기자금이 필요합니다.", "기존 부채가 일부 여력을 사용합니다."],
        recommendedActions: ["월 저축액 유지", "전세보증금 반환 시점 점검", "광명·안양 실거래 추적"],
        followUpQuestions: ["보너스 변동성은 어느 정도인가요?", "생활권을 얼마나 넓힐 수 있나요?"],
        provider: "template",
      },
    );
    const updatedDashboard = buildDashboardFixture(true);
    updatedDashboard.latestRun = updatedRun;
    updatedDashboard.financialSnapshot = updatedFinancialSnapshot;
    updatedDashboard.housingGoal = updatedHousingGoal;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draft }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ snapshot: updatedFinancialSnapshot }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ goal: updatedHousingGoal }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ run: updatedRun }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ dashboard: updatedDashboard }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <PlannerShell
        initialDashboard={initialDashboard}
        sessionEmail="hmnr@example.com"
        authConfigured={false}
        authMode="demo"
        authenticated={false}
      />,
    );

    for (const question of interviewQuestions) {
      const value =
        {
          hyunminMonthlyNetIncome: "370만원",
          hyunminMonthlyVariableIncome: "20만원",
          nuriMonthlyNetIncome: "280만원",
          nuriMonthlyVariableIncome: "10만원",
          monthlyFixedExpenses: "290만원",
          monthlyCurrentHousingCost: "110만원",
          currentMonthlySavings: "230만원",
          cashAssets: "1.6억",
          subscriptionSavings: "1800만원",
          jeonseReturnAmount: "7000만원",
          outstandingDebt: "2000만원",
          otherDebtMonthlyService: "25만원",
          expectedAnnualBonus: "400만원",
          preferredRegions: "광명, 마포, 분당",
          commuteMaxMinutes: "60",
          targetTimeframeMonths: "48",
        }[question.id] ?? "";
      const input = screen.getByPlaceholderText(question.placeholder);
      await user.type(input, value);
      await user.click(
        screen.getByRole("button", {
          name: question.id === "targetTimeframeMonths" ? "구조화 초안 만들기" : "다음 질문",
        }),
      );
    }

    await waitFor(() => {
      expect(screen.getByText(/초안 생성 완료/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "저장하고 매수 가능 시점 계산" }));

    await waitFor(() => {
      expect(screen.getAllByText("고양·부천").length).toBeGreaterThan(0);
      expect(screen.getByText(/AI 요약/)).toBeInTheDocument();
    });
  });
});
