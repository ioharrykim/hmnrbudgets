import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlannerShell } from "@/components/planner-shell";
import { interviewQuestions } from "@/lib/interview/questions";
import { normalizeInterviewAnswers } from "@/lib/interview/normalize";
import { computeAffordabilityRun } from "@/lib/finance/affordability";
import { promotedMarketSnapshots } from "@/lib/market/market-seed";
import { basePolicySnapshot } from "@/lib/policy/policy-seed";
import { createPublicDashboard } from "@/lib/public-dashboard";
import { buildDashboardFixture, buildFinancialSnapshotFixture, buildHousingGoalFixture } from "@/test/fixtures";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

describe("PlannerShell flow", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    window.localStorage.clear();
  });

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
      expect(screen.getByText("인터뷰 초안이 준비되었습니다. 아래 폼에서 숫자를 수정하세요.")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "저장하고 매수 가능 시점 계산" }));

    await waitFor(() => {
      expect(screen.getAllByText("고양·부천").length).toBeGreaterThan(0);
      expect(screen.getByText(/AI 요약/)).toBeInTheDocument();
      expect(screen.getByText("계산 결과를 업데이트했습니다. 오른쪽 대시보드를 확인하세요.")).toBeInTheDocument();
    });
  });

  it("blocks interview submission until Supabase auth is complete", () => {
    render(
      <PlannerShell
        initialDashboard={buildDashboardFixture(false)}
        sessionEmail=""
        authConfigured={true}
        authMode="supabase"
        authenticated={false}
      />,
    );

    expect(
      screen.getByText("먼저 Step 1에서 이메일 로그인 링크를 열어 인증해야 인터뷰 초안을 저장할 수 있습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 질문" })).toBeDisabled();
  });

  it("blocks interview submission until 4-digit code auth is complete", () => {
    render(
      <PlannerShell
        initialDashboard={buildDashboardFixture(false)}
        sessionEmail=""
        authConfigured={true}
        authMode="pin"
        authenticated={false}
      />,
    );

    expect(
      screen.getByText("먼저 Step 1에서 이메일과 4자리 코드로 인증해야 인터뷰 초안을 저장할 수 있습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 질문" })).toBeDisabled();
  });

  it("submits email and 4-digit code, then refreshes the session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ household: { id: "household_fixture" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <PlannerShell
        initialDashboard={buildDashboardFixture(false)}
        sessionEmail=""
        authConfigured={true}
        authMode="pin"
        authenticated={false}
      />,
    );

    await user.type(screen.getByLabelText("이메일"), "hmnr@example.com");
    const pinInput = screen.getByLabelText("4자리 코드");
    expect(screen.getByRole("button", { name: "코드 확인" })).toBeDisabled();

    await user.type(pinInput, "12a34");

    expect(pinInput).toHaveValue("1234");
    await user.click(screen.getByRole("button", { name: "코드 확인" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/session/pin-login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "hmnr@example.com", pin: "1234" }),
        }),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("uses the refreshed household after auth instead of the public placeholder household", async () => {
    const householdId = "household_fixture";
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
    const { rerender } = render(
      <PlannerShell
        initialDashboard={createPublicDashboard()}
        sessionEmail=""
        authConfigured={true}
        authMode="pin"
        authenticated={false}
      />,
    );

    rerender(
      <PlannerShell
        initialDashboard={buildDashboardFixture(false)}
        sessionEmail="hmnr@example.com"
        authConfigured={true}
        authMode="pin"
        authenticated={true}
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
      expect(screen.getByText("인터뷰 초안이 준비되었습니다. 아래 폼에서 숫자를 수정하세요.")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "저장하고 매수 가능 시점 계산" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/financial-snapshots",
        expect.objectContaining({
          body: expect.stringContaining(`"householdId":"${householdId}"`),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/housing-goals",
        expect.objectContaining({
          body: expect.stringContaining(`"householdId":"${householdId}"`),
        }),
      );
    });
  });

  it("restores structured form values after refresh from local storage", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <PlannerShell
        initialDashboard={buildDashboardFixture(false)}
        sessionEmail="hmnr@example.com"
        authConfigured={false}
        authMode="demo"
        authenticated={false}
      />,
    );

    const cashInput = screen.getByLabelText("현금성 자산");
    await user.clear(cashInput);
    await user.type(cashInput, "210000000");

    const regionInput = screen.getByLabelText("희망 생활권");
    await user.clear(regionInput);
    await user.type(regionInput, "광명, 안양");

    unmount();

    render(
      <PlannerShell
        initialDashboard={buildDashboardFixture(false)}
        sessionEmail="hmnr@example.com"
        authConfigured={false}
        authMode="demo"
        authenticated={false}
      />,
    );

    expect(screen.getByLabelText("현금성 자산")).toHaveValue(210000000);
    expect(screen.getByLabelText("희망 생활권")).toHaveValue("광명, 안양");
  });
});
