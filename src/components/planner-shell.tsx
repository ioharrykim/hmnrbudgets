"use client";

import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { APP_NAME, INTERVIEW_HINTS, OFFICIAL_SOURCE_LINKS } from "@/lib/constants";
import { formatCompactKrw, formatCurrency, formatMonths } from "@/lib/format";
import { interviewQuestions } from "@/lib/interview/questions";
import type {
  DashboardPayload,
  FinancialSnapshot,
  HousingGoal,
  InterviewAnswer,
  InterviewDraft,
  MarketSnapshot,
} from "@/lib/types";
import { makeId } from "@/lib/utils";

type PlannerShellProps = {
  initialDashboard: DashboardPayload;
  sessionEmail: string;
  authConfigured: boolean;
  authMode: "demo" | "supabase" | "pin";
  authenticated: boolean;
};

type FinancialFormState = {
  hyunminMonthlyNetIncome: number;
  hyunminMonthlyVariableIncome: number;
  nuriMonthlyNetIncome: number;
  nuriMonthlyVariableIncome: number;
  monthlyFixedExpenses: number;
  monthlyCurrentHousingCost: number;
  currentMonthlySavings: number;
  cashAssets: number;
  subscriptionSavings: number;
  jeonseReturnAmount: number;
  outstandingDebt: number;
  otherDebtMonthlyService: number;
  expectedAnnualBonus: number;
};

type GoalFormState = {
  preferredRegions: string;
  targetTimeframeMonths: number;
  commuteMaxMinutes: number;
  minimumExclusiveAreaM2: number;
  priorities: string;
};

function defaultFinancialForm(snapshot: FinancialSnapshot | null): FinancialFormState {
  const hyunmin = snapshot?.members[0];
  const nuri = snapshot?.members[1];
  return {
    hyunminMonthlyNetIncome: hyunmin?.monthlyNetIncome ?? 0,
    hyunminMonthlyVariableIncome: hyunmin?.monthlyVariableIncome ?? 0,
    nuriMonthlyNetIncome: nuri?.monthlyNetIncome ?? 0,
    nuriMonthlyVariableIncome: nuri?.monthlyVariableIncome ?? 0,
    monthlyFixedExpenses: snapshot?.monthlyFixedExpenses ?? 0,
    monthlyCurrentHousingCost: snapshot?.monthlyCurrentHousingCost ?? 0,
    currentMonthlySavings: snapshot?.currentMonthlySavings ?? 0,
    cashAssets: snapshot?.cashAssets ?? 0,
    subscriptionSavings: snapshot?.subscriptionSavings ?? 0,
    jeonseReturnAmount: snapshot?.jeonseReturnAmount ?? 0,
    outstandingDebt: snapshot?.outstandingDebt ?? 0,
    otherDebtMonthlyService: snapshot?.otherDebtMonthlyService ?? 0,
    expectedAnnualBonus: snapshot?.expectedAnnualBonus ?? 0,
  };
}

function defaultGoalForm(goal: HousingGoal | null): GoalFormState {
  return {
    preferredRegions: goal?.preferredRegions.join(", ") ?? "",
    targetTimeframeMonths: goal?.targetTimeframeMonths ?? 48,
    commuteMaxMinutes: goal?.commuteMaxMinutes ?? 60,
    minimumExclusiveAreaM2: goal?.minimumExclusiveAreaM2 ?? 59,
    priorities: goal?.priorities.join(", ") ?? "현금흐름 안정, 출퇴근 균형, 3~5년 내 매수",
  };
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "요청 처리에 실패했습니다.");
  }

  return body as T;
}

function rankMarkets(markets: MarketSnapshot[], preferredRegions: string) {
  const preferred = preferredRegions
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (preferred.length === 0) {
    return markets;
  }

  return [...markets].sort((a, b) => {
    const aScore = preferred.some((region) => a.regionName.includes(region) || a.lifestyleLabel.includes(region)) ? 1 : 0;
    const bScore = preferred.some((region) => b.regionName.includes(region) || b.lifestyleLabel.includes(region)) ? 1 : 0;
    return bScore - aScore || a.priceBandMid - b.priceBandMid;
  });
}

export function PlannerShell({
  initialDashboard,
  sessionEmail,
  authConfigured,
  authMode,
  authenticated,
}: PlannerShellProps) {
  const router = useRouter();
  const [email, setEmail] = useState(sessionEmail);
  const [pin, setPin] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [draft, setDraft] = useState<InterviewDraft | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerInput, setAnswerInput] = useState("");
  const [financialForm, setFinancialForm] = useState(defaultFinancialForm(initialDashboard.financialSnapshot));
  const [goalForm, setGoalForm] = useState(defaultGoalForm(initialDashboard.housingGoal));
  const [savePending, setSavePending] = useState(false);
  const [interviewPending, setInterviewPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDashboard(initialDashboard);
  }, [initialDashboard]);

  useEffect(() => {
    setEmail(sessionEmail);
  }, [sessionEmail]);

  useEffect(() => {
    setFinancialForm(defaultFinancialForm(dashboard.financialSnapshot));
    setGoalForm(defaultGoalForm(dashboard.housingGoal));
  }, [dashboard]);

  const answeredQuestions = useMemo(() => {
    return interviewQuestions.filter((question) => answers[question.id]);
  }, [answers]);

  const marketCandidates = useMemo(() => {
    return rankMarkets(dashboard.promotedMarkets, goalForm.preferredRegions);
  }, [dashboard.promotedMarkets, goalForm.preferredRegions]);

  const nextQuestion = interviewQuestions[currentQuestionIndex] ?? null;
  const requiresAuth = authConfigured && !authenticated;
  const authRequirementCopy =
    authMode === "pin"
      ? "먼저 Step 1에서 이메일과 4자리 코드로 인증해야 인터뷰 초안을 저장할 수 있습니다."
      : "먼저 Step 1에서 이메일 로그인 링크를 열어 인증해야 인터뷰 초안을 저장할 수 있습니다.";

  async function refreshDashboard() {
    const response = await requestJson<{ dashboard: DashboardPayload }>("/api/dashboard");
    setDashboard(response.dashboard);
  }

  async function handleSessionLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginPending(true);
    setError(null);
    setSessionNotice(null);

    try {
      const path =
        authMode === "pin"
          ? "/api/session/pin-login"
          : authMode === "supabase"
            ? "/api/session/magic-link"
            : "/api/session/demo";
      await requestJson(path, {
        method: "POST",
        body: JSON.stringify(authMode === "pin" ? { email, pin } : { email }),
      });

      if (path === "/api/session/magic-link") {
        setSessionNotice("로그인 링크를 보냈습니다. 메일에서 링크를 열면 현재 브라우저 세션에 연결됩니다.");
      } else {
        router.refresh();
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인에 실패했습니다.");
    } finally {
      setLoginPending(false);
    }
  }

  async function handleLogout() {
    setLoginPending(true);
    setError(null);
    setSessionNotice(null);
    try {
      await requestJson("/api/session/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "로그아웃에 실패했습니다.");
    } finally {
      setLoginPending(false);
    }
  }

  async function handleInterviewSubmit(answerMap: Record<string, string>) {
    const payloadAnswers: InterviewAnswer[] = interviewQuestions.map((question) => ({
      questionId: question.id,
      answer: answerMap[question.id] ?? "",
    }));
    const response = await requestJson<{ draft: InterviewDraft }>("/api/onboarding/interview", {
      method: "POST",
      body: JSON.stringify({ answers: payloadAnswers }),
    });

    setDraft(response.draft);
    setFinancialForm(defaultFinancialForm(response.draft.financialSnapshot));
    setGoalForm(defaultGoalForm(response.draft.housingGoal));
    setCurrentQuestionIndex(interviewQuestions.length);
  }

  function handleAnswerAdvance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nextQuestion) {
      return;
    }

    const submittedAnswer = answerInput.trim();
    const nextAnswers = {
      ...answers,
      [nextQuestion.id]: submittedAnswer,
    };
    setAnswers(nextAnswers);
    setAnswerInput("");
    setError(null);

    if (currentQuestionIndex === interviewQuestions.length - 1) {
      setInterviewPending(true);
      startTransition(() => {
        void handleInterviewSubmit(nextAnswers)
          .catch((submitError) => {
            setError(submitError instanceof Error ? submitError.message : "인터뷰 구조화에 실패했습니다.");
          })
          .finally(() => {
            setInterviewPending(false);
          });
      });
      return;
    }

    setCurrentQuestionIndex((current) => current + 1);
  }

  function updateFinancialField(field: keyof FinancialFormState, value: number) {
    setFinancialForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateGoalField(field: keyof GoalFormState, value: string | number) {
    setGoalForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveScenario() {
    if (!dashboard.household) {
      return;
    }

    setSavePending(true);
    setError(null);

    const householdId = dashboard.household.id;
    const financialSnapshot: FinancialSnapshot = {
      id: draft?.financialSnapshot.id ?? dashboard.financialSnapshot?.id ?? makeId("financial"),
      householdId,
      capturedAt: new Date().toISOString(),
      members: [
        {
          id: draft?.financialSnapshot.members[0]?.id ?? dashboard.financialSnapshot?.members[0]?.id ?? makeId("member"),
          householdId,
          name: "현민",
          roleLabel: "본인",
          monthlyNetIncome: financialForm.hyunminMonthlyNetIncome,
          monthlyVariableIncome: financialForm.hyunminMonthlyVariableIncome,
          employmentType: "employee",
        },
        {
          id: draft?.financialSnapshot.members[1]?.id ?? dashboard.financialSnapshot?.members[1]?.id ?? makeId("member"),
          householdId,
          name: "누리",
          roleLabel: "배우자",
          monthlyNetIncome: financialForm.nuriMonthlyNetIncome,
          monthlyVariableIncome: financialForm.nuriMonthlyVariableIncome,
          employmentType: "employee",
        },
      ],
      monthlyFixedExpenses: financialForm.monthlyFixedExpenses,
      monthlyCurrentHousingCost: financialForm.monthlyCurrentHousingCost,
      currentMonthlySavings: financialForm.currentMonthlySavings,
      cashAssets: financialForm.cashAssets,
      subscriptionSavings: financialForm.subscriptionSavings,
      jeonseReturnAmount: financialForm.jeonseReturnAmount,
      otherInvestableAssets: 0,
      outstandingDebt: financialForm.outstandingDebt,
      otherDebtMonthlyService: financialForm.otherDebtMonthlyService,
      expectedAnnualBonus: financialForm.expectedAnnualBonus,
    };

    const housingGoal: HousingGoal = {
      id: draft?.housingGoal.id ?? dashboard.housingGoal?.id ?? makeId("goal"),
      householdId,
      capturedAt: new Date().toISOString(),
      preferredRegions: goalForm.preferredRegions
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      targetTimeframeMonths: goalForm.targetTimeframeMonths,
      commuteMaxMinutes: goalForm.commuteMaxMinutes,
      minimumExclusiveAreaM2: goalForm.minimumExclusiveAreaM2,
      priorities: goalForm.priorities
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };

    try {
      await requestJson("/api/financial-snapshots", {
        method: "POST",
        body: JSON.stringify(financialSnapshot),
      });
      await requestJson("/api/housing-goals", {
        method: "POST",
        body: JSON.stringify(housingGoal),
      });
      await requestJson("/api/affordability-runs/recompute", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "계산 실행에 실패했습니다.");
    } finally {
      setSavePending(false);
    }
  }

  const headlineRun = dashboard.latestRun?.scenarios.base;

  return (
    <div className="shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">2026.03 기준 한국 아파트 매수 플래너</p>
          <h1>{APP_NAME}</h1>
          <p className="hero-copy">
            현민과 누리의 현재 자산, 월 저축 속도, 대출 가능성, 서울·인접 경기권 매수 밴드를 한 화면에서
            역산합니다.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span>안전한 월 주거비</span>
            <strong>
              {dashboard.latestRun
                ? formatCurrency(dashboard.latestRun.safeMonthlyHousingBudget)
                : "인터뷰 후 계산"}
            </strong>
          </div>
          <div className="metric-card">
            <span>현재 우선 후보지</span>
            <strong>{dashboard.latestRun?.recommendedMarket?.regionName ?? "아직 없음"}</strong>
          </div>
          <div className="metric-card">
            <span>매수 예상 시점</span>
            <strong>{headlineRun ? formatMonths(headlineRun.monthsToGoal) : "데이터 필요"}</strong>
          </div>
        </div>
      </section>

      <section className="grid-layout">
        <div className="stack">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Step 1</p>
                <h2>이메일 세션</h2>
              </div>
              <span className="demo-badge">
                {authMode === "pin" ? "4-digit access code" : authMode === "supabase" ? "Supabase magic link" : "Demo email session"}
              </span>
            </div>
            <form className="session-form" onSubmit={handleSessionLogin}>
              <label>
                이메일
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              {authMode === "pin" ? (
                <label>
                  4자리 코드
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="1234"
                  />
                </label>
              ) : null}
              {authConfigured && authenticated && authMode === "supabase" ? (
                <button type="button" disabled={loginPending} onClick={handleLogout}>
                  {loginPending ? "로그아웃 중..." : "로그아웃"}
                </button>
              ) : authConfigured && authenticated && authMode === "pin" ? (
                <button type="button" disabled={loginPending} onClick={handleLogout}>
                  {loginPending ? "세션 종료 중..." : "세션 종료"}
                </button>
              ) : (
                <button type="submit" disabled={loginPending || (authMode === "pin" && pin.length !== 4)}>
                  {loginPending
                    ? "세션 연결 중..."
                    : authMode === "pin"
                      ? "코드 확인"
                      : authConfigured
                      ? "로그인 링크 보내기"
                      : "이 이메일로 시작"}
                </button>
              )}
            </form>
            <p className="session-copy">
              {authMode === "pin"
                ? authenticated
                  ? `${email} 계정으로 4자리 코드 인증이 완료되었습니다. 이후 데이터는 같은 이메일 household에 저장됩니다.`
                  : "이메일과 4자리 접근코드를 입력하면 바로 세션이 열리고, 데이터는 서버에 저장됩니다."
                : authConfigured
                ? authenticated && authMode === "supabase"
                  ? `${email} 계정으로 인증되었습니다. 저장 데이터는 Supabase household에 연결됩니다.`
                  : "Supabase가 설정돼 있으면 이메일 magic link로 로그인하고, 서버는 해당 계정 이메일로 household를 불러옵니다."
                : "Supabase 설정이 없으면 브라우저 쿠키 기반 demo 세션으로 household를 식별합니다."}
            </p>
            {sessionNotice ? <p className="notice-box">{sessionNotice}</p> : null}
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Step 2</p>
                <h2>대화형 인터뷰</h2>
              </div>
              <span className="question-progress">
                {Math.min(answeredQuestions.length + 1, interviewQuestions.length)} / {interviewQuestions.length}
              </span>
            </div>
            {requiresAuth ? (
              <p className="notice-box">{authRequirementCopy}</p>
            ) : null}
            <div className="chat-log">
              {answeredQuestions.map((question) => (
                <div key={question.id} className="chat-pair">
                  <div className="chat-bubble planner">
                    <span>{question.speaker}</span>
                    <p>{question.prompt}</p>
                  </div>
                  <div className="chat-bubble user">
                    <span>현민·누리</span>
                    <p>{answers[question.id]}</p>
                  </div>
                </div>
              ))}
              {nextQuestion ? (
                <div className="chat-pair">
                  <div className="chat-bubble planner current">
                    <span>{nextQuestion.speaker}</span>
                    <p>{nextQuestion.prompt}</p>
                  </div>
                </div>
              ) : null}
            </div>
            {nextQuestion ? (
              <form className="answer-form" onSubmit={handleAnswerAdvance}>
                <input
                  value={answerInput}
                  onChange={(event) => setAnswerInput(event.target.value)}
                  placeholder={nextQuestion.placeholder}
                  disabled={requiresAuth || interviewPending}
                />
                <button type="submit" disabled={!answerInput.trim() || requiresAuth || interviewPending}>
                  {interviewPending
                    ? "구조화 중..."
                    : currentQuestionIndex === interviewQuestions.length - 1
                      ? "구조화 초안 만들기"
                      : "다음 질문"}
                </button>
              </form>
            ) : (
              <div className="interview-complete">인터뷰 초안이 준비되었습니다. 아래 폼에서 숫자를 수정하세요.</div>
            )}
            <ul className="hint-list">
              {INTERVIEW_HINTS.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Step 3</p>
                <h2>구조화 폼 확정</h2>
              </div>
              <span className="draft-status">
                {draft ? `초안 생성 완료${draft.missingFields.length ? ` · 누락 ${draft.missingFields.length}개` : ""}` : "초안 대기"}
              </span>
            </div>

            <div className="form-grid">
              <label>
                현민 월 실수령
                <input
                  type="number"
                  value={financialForm.hyunminMonthlyNetIncome}
                  onChange={(event) => updateFinancialField("hyunminMonthlyNetIncome", Number(event.target.value))}
                />
              </label>
              <label>
                현민 월 변동수입
                <input
                  type="number"
                  value={financialForm.hyunminMonthlyVariableIncome}
                  onChange={(event) => updateFinancialField("hyunminMonthlyVariableIncome", Number(event.target.value))}
                />
              </label>
              <label>
                누리 월 실수령
                <input
                  type="number"
                  value={financialForm.nuriMonthlyNetIncome}
                  onChange={(event) => updateFinancialField("nuriMonthlyNetIncome", Number(event.target.value))}
                />
              </label>
              <label>
                누리 월 변동수입
                <input
                  type="number"
                  value={financialForm.nuriMonthlyVariableIncome}
                  onChange={(event) => updateFinancialField("nuriMonthlyVariableIncome", Number(event.target.value))}
                />
              </label>
              <label>
                월 고정지출
                <input
                  type="number"
                  value={financialForm.monthlyFixedExpenses}
                  onChange={(event) => updateFinancialField("monthlyFixedExpenses", Number(event.target.value))}
                />
              </label>
              <label>
                현재 월 주거비
                <input
                  type="number"
                  value={financialForm.monthlyCurrentHousingCost}
                  onChange={(event) => updateFinancialField("monthlyCurrentHousingCost", Number(event.target.value))}
                />
              </label>
              <label>
                월 저축 가능액
                <input
                  type="number"
                  value={financialForm.currentMonthlySavings}
                  onChange={(event) => updateFinancialField("currentMonthlySavings", Number(event.target.value))}
                />
              </label>
              <label>
                현금성 자산
                <input
                  type="number"
                  value={financialForm.cashAssets}
                  onChange={(event) => updateFinancialField("cashAssets", Number(event.target.value))}
                />
              </label>
              <label>
                청약·주택저축
                <input
                  type="number"
                  value={financialForm.subscriptionSavings}
                  onChange={(event) => updateFinancialField("subscriptionSavings", Number(event.target.value))}
                />
              </label>
              <label>
                전세보증금 반환
                <input
                  type="number"
                  value={financialForm.jeonseReturnAmount}
                  onChange={(event) => updateFinancialField("jeonseReturnAmount", Number(event.target.value))}
                />
              </label>
              <label>
                대출 원금
                <input
                  type="number"
                  value={financialForm.outstandingDebt}
                  onChange={(event) => updateFinancialField("outstandingDebt", Number(event.target.value))}
                />
              </label>
              <label>
                대출 월 상환액
                <input
                  type="number"
                  value={financialForm.otherDebtMonthlyService}
                  onChange={(event) => updateFinancialField("otherDebtMonthlyService", Number(event.target.value))}
                />
              </label>
              <label>
                연 보너스
                <input
                  type="number"
                  value={financialForm.expectedAnnualBonus}
                  onChange={(event) => updateFinancialField("expectedAnnualBonus", Number(event.target.value))}
                />
              </label>
              <label>
                희망 생활권
                <input
                  value={goalForm.preferredRegions}
                  onChange={(event) => updateGoalField("preferredRegions", event.target.value)}
                />
              </label>
              <label>
                목표 기간(개월)
                <input
                  type="number"
                  value={goalForm.targetTimeframeMonths}
                  onChange={(event) => updateGoalField("targetTimeframeMonths", Number(event.target.value))}
                />
              </label>
              <label>
                최대 통근시간(분)
                <input
                  type="number"
                  value={goalForm.commuteMaxMinutes}
                  onChange={(event) => updateGoalField("commuteMaxMinutes", Number(event.target.value))}
                />
              </label>
              <label>
                최소 전용면적(㎡)
                <input
                  type="number"
                  value={goalForm.minimumExclusiveAreaM2}
                  onChange={(event) => updateGoalField("minimumExclusiveAreaM2", Number(event.target.value))}
                />
              </label>
              <label className="wide">
                우선순위
                <input value={goalForm.priorities} onChange={(event) => updateGoalField("priorities", event.target.value)} />
              </label>
            </div>

            {draft ? <p className="draft-summary">{draft.summary}</p> : null}
            {error ? <p className="error-box">{error}</p> : null}

            <button className="primary-button" onClick={handleSaveScenario} disabled={savePending || requiresAuth}>
              {savePending ? "계산 중..." : "저장하고 매수 가능 시점 계산"}
            </button>
          </article>
        </div>

        <DashboardView dashboard={dashboard} rankedMarkets={marketCandidates} />
      </section>

      <section className="footer-strip">
        <p>기준일: 2026-03-10. 검수 완료된 공식 발표 데이터만 계산에 반영합니다.</p>
        <div className="source-links">
          {OFFICIAL_SOURCE_LINKS.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function DashboardView({
  dashboard,
  rankedMarkets,
}: {
  dashboard: DashboardPayload;
  rankedMarkets: MarketSnapshot[];
}) {
  const run = dashboard.latestRun;
  const baseScenario = run?.scenarios.base;

  return (
    <div className="stack dashboard-stack">
      <article className="panel dashboard-panel spotlight">
        <div className="panel-header">
          <div>
            <p className="section-label">언제 살 수 있나</p>
            <h2>{run ? `${formatMonths(baseScenario?.monthsToGoal ?? 0)} 준비` : "먼저 인터뷰를 완료하세요."}</h2>
          </div>
          <span className="basis-date">기준일 {dashboard.latestPolicySnapshot.basisDate}</span>
        </div>
        {run ? (
          <div className="summary-grid">
            <div className="summary-card">
              <span>안전한 최대 매수가</span>
              <strong>{formatCurrency(baseScenario?.safeMaxPurchasePrice ?? 0)}</strong>
            </div>
            <div className="summary-card">
              <span>필요 자기자금</span>
              <strong>{formatCurrency(baseScenario?.requiredSelfFunding ?? 0)}</strong>
            </div>
            <div className="summary-card">
              <span>일반 주담대 보수 추정</span>
              <strong>{formatCurrency(baseScenario?.generalLoanCapacity ?? 0)}</strong>
            </div>
            <div className="summary-card">
              <span>월 추가 저축 필요액</span>
              <strong>{formatCurrency(baseScenario?.additionalMonthlySavingsNeeded ?? 0)}</strong>
            </div>
          </div>
        ) : (
          <p className="empty-copy">
            인터뷰와 구조화 폼을 채우면 안전한 매수가, 필요한 현금, 매수 예상 시점을 계산합니다.
          </p>
        )}
      </article>

      <article className="panel dashboard-panel">
        <div className="panel-header">
          <div>
            <p className="section-label">얼마가 필요하나</p>
            <h2>정책대출 및 현금 격차</h2>
          </div>
        </div>
        {run ? (
          <>
            <div className="policy-grid">
              {run.policyEligibility.map((policy) => (
                <div key={policy.product} className={clsx("policy-card", policy.eligible ? "eligible" : "ineligible")}>
                  <span>{policy.product === "bogeumjari" ? "보금자리론" : "디딤돌 / 신혼 구입자금"}</span>
                  <strong>{policy.eligible ? "가능성 있음" : "현재 기준 어려움"}</strong>
                  <p>{policy.reason}</p>
                  <small>
                    한도 {formatCompactKrw(policy.maxLoanAmount)} / 금리 {policy.rate.toFixed(2)}%
                  </small>
                </div>
              ))}
            </div>
            <div className="scenario-table">
              {Object.values(run.scenarios).map((scenario) => (
                <div key={scenario.scenario} className="scenario-row">
                  <div>
                    <span>{scenario.scenario === "conservative" ? "보수" : scenario.scenario === "base" ? "기준" : "낙관"} 시나리오</span>
                    <strong>{scenario.targetRegion}</strong>
                  </div>
                  <p>
                    {formatCurrency(scenario.targetRegionMidPrice)} 목표 / 준비기간 {formatMonths(scenario.monthsToGoal)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="empty-copy">저장된 재무 스냅샷이 없습니다.</p>
        )}
      </article>

      <article className="panel dashboard-panel">
        <div className="panel-header">
          <div>
            <p className="section-label">어떻게 준비하나</p>
            <h2>생활권 비교와 액션 플랜</h2>
          </div>
        </div>
        {run ? (
          <>
            <div className="market-list">
              {run.marketSuitability.slice(0, 4).map((market) => (
                <div key={market.marketSnapshotId} className={clsx("market-card", market.suitability)}>
                  <div>
                    <span>{market.regionName}</span>
                    <strong>{formatCurrency(market.targetPrice)}</strong>
                  </div>
                  <p>{market.narrative}</p>
                  <small>
                    필요 현금 {formatCurrency(market.requiredCash)} / 격차 {formatCurrency(market.cashGap)}
                  </small>
                </div>
              ))}
            </div>

            <div className="action-list">
              {run.actionPlan.items.map((item) => (
                <div key={item.id} className="action-card">
                  <span>{item.horizon === "now" ? "지금" : item.horizon === "quarter" ? "1분기" : "1년"}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="ai-panel">
              <span className="section-label">AI 요약 ({run.aiInsight.provider})</span>
              <p className="ai-summary">{run.aiInsight.summary}</p>
              <div className="ai-columns">
                <div>
                  <strong>핵심 리스크</strong>
                  <ul>
                    {run.aiInsight.risks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>다음 3개 행동</strong>
                  <ul>
                    {run.aiInsight.recommendedActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>추가 질문</strong>
                  <ul>
                    {run.aiInsight.followUpQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="empty-copy">질문에 답한 뒤 계산을 실행하면 월별 준비 전략이 생성됩니다.</p>
        )}
      </article>

      <article className="panel dashboard-panel">
        <div className="panel-header">
          <div>
            <p className="section-label">시장 후보</p>
            <h2>서울 + 인접 경기 밴드</h2>
          </div>
        </div>
        <div className="candidate-list">
          {rankedMarkets.map((market) => (
            <div key={market.id} className="candidate-row">
              <div>
                <strong>{market.regionName}</strong>
                <span>{market.lifestyleLabel}</span>
              </div>
              <div>
                <strong>{formatCurrency(market.priceBandMid)}</strong>
                <span>{market.freshness === "pending" ? "최신 발표 대기 중" : `${market.publishedMonth} 발표`}</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
