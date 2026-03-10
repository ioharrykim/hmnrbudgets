import { computeAffordabilityRun } from "@/lib/finance/affordability";
import { generateAiInsight } from "@/lib/ai/adapter";
import { getRepository } from "@/lib/storage";

export async function recomputeHouseholdRun(householdId: string) {
  const repository = getRepository();
  const [financialSnapshot, housingGoal, policySnapshot, markets] = await Promise.all([
    repository.getLatestFinancialSnapshot(householdId),
    repository.getHousingGoal(householdId),
    repository.getPromotedPolicySnapshot(),
    repository.getPromotedMarketSnapshots(),
  ]);

  if (!financialSnapshot || !housingGoal) {
    return null;
  }

  const preliminaryRun = computeAffordabilityRun(
    householdId,
    financialSnapshot,
    housingGoal,
    policySnapshot,
    markets,
    {
      summary: "",
      risks: [],
      recommendedActions: [],
      followUpQuestions: [],
      provider: "template",
    },
  );

  const aiInsight = await generateAiInsight({
    financialSnapshot,
    housingGoal,
    policySnapshot,
    markets,
    preliminaryRun,
  });

  const completedRun = {
    ...preliminaryRun,
    aiInsight,
  };

  await repository.saveAffordabilityRun(completedRun);
  return completedRun;
}
