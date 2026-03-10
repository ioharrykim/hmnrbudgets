import { DEFAULT_DATE, DEFAULT_HOUSEHOLD_NAME } from "@/lib/constants";
import { interviewQuestions } from "@/lib/interview/questions";
import { buildMemberIncomes, parseKoreanMoney, parseNumber, parseRegionList } from "@/lib/parsing";
import type { FinancialSnapshot, HousingGoal, InterviewAnswer, InterviewDraft } from "@/lib/types";
import { makeId } from "@/lib/utils";

function missingFieldsFromAnswers(answers: Record<string, string>) {
  return interviewQuestions
    .filter((question) => !answers[question.id]?.trim())
    .map((question) => question.prompt);
}

export function normalizeInterviewAnswers(
  householdId: string,
  answers: InterviewAnswer[],
  householdName = DEFAULT_HOUSEHOLD_NAME,
): InterviewDraft {
  const answerMap = Object.fromEntries(answers.map((answer) => [answer.questionId, answer.answer]));
  const members = buildMemberIncomes(answerMap).map((member) => ({
    id: makeId("member"),
    householdId,
    ...member,
  }));

  const financialSnapshot: FinancialSnapshot = {
    id: makeId("financial"),
    householdId,
    capturedAt: DEFAULT_DATE,
    members,
    monthlyFixedExpenses: parseKoreanMoney(answerMap.monthlyFixedExpenses ?? ""),
    monthlyCurrentHousingCost: parseKoreanMoney(answerMap.monthlyCurrentHousingCost ?? ""),
    currentMonthlySavings: parseKoreanMoney(answerMap.currentMonthlySavings ?? ""),
    cashAssets: parseKoreanMoney(answerMap.cashAssets ?? ""),
    subscriptionSavings: parseKoreanMoney(answerMap.subscriptionSavings ?? ""),
    jeonseReturnAmount: parseKoreanMoney(answerMap.jeonseReturnAmount ?? ""),
    otherInvestableAssets: 0,
    outstandingDebt: parseKoreanMoney(answerMap.outstandingDebt ?? ""),
    otherDebtMonthlyService: parseKoreanMoney(answerMap.otherDebtMonthlyService ?? ""),
    expectedAnnualBonus: parseKoreanMoney(answerMap.expectedAnnualBonus ?? ""),
  };

  const housingGoal: HousingGoal = {
    id: makeId("goal"),
    householdId,
    capturedAt: DEFAULT_DATE,
    preferredRegions: parseRegionList(answerMap.preferredRegions ?? ""),
    targetTimeframeMonths: Math.max(parseNumber(answerMap.targetTimeframeMonths ?? "") || 48, 1),
    commuteMaxMinutes: Math.max(parseNumber(answerMap.commuteMaxMinutes ?? "") || 60, 20),
    minimumExclusiveAreaM2: 59,
    priorities: ["현금흐름 안정", "출퇴근 균형", "3~5년 내 매수"],
  };

  return {
    householdName,
    financialSnapshot,
    housingGoal,
    missingFields: missingFieldsFromAnswers(answerMap),
    summary: `${householdName}의 현재 입력을 기준으로 월 저축 여력과 자기자금을 구조화했습니다.`,
  };
}
