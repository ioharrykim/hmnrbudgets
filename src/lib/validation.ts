import { z } from "zod";

export const sessionSchema = z.object({
  email: z.string().email(),
});

export const interviewAnswerSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
});

export const interviewPayloadSchema = z.object({
  answers: z.array(interviewAnswerSchema).min(1),
});

const memberSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string(),
  roleLabel: z.string(),
  monthlyNetIncome: z.number().nonnegative(),
  monthlyVariableIncome: z.number().nonnegative(),
  employmentType: z.enum(["employee", "self-employed", "contractor", "other"]),
});

export const financialSnapshotSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  capturedAt: z.string(),
  members: z.array(memberSchema).length(2),
  monthlyFixedExpenses: z.number().nonnegative(),
  monthlyCurrentHousingCost: z.number().nonnegative(),
  currentMonthlySavings: z.number().nonnegative(),
  cashAssets: z.number().nonnegative(),
  subscriptionSavings: z.number().nonnegative(),
  jeonseReturnAmount: z.number().nonnegative(),
  otherInvestableAssets: z.number().nonnegative(),
  outstandingDebt: z.number().nonnegative(),
  otherDebtMonthlyService: z.number().nonnegative(),
  expectedAnnualBonus: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const housingGoalSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  capturedAt: z.string(),
  preferredRegions: z.array(z.string()).min(1),
  targetTimeframeMonths: z.number().int().positive(),
  commuteMaxMinutes: z.number().int().positive(),
  minimumExclusiveAreaM2: z.number().positive(),
  priorities: z.array(z.string()).min(1),
  notes: z.string().optional(),
});
