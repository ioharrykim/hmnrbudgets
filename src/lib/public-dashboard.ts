import { basePolicySnapshot } from "@/lib/policy/policy-seed";
import { promotedMarketSnapshots } from "@/lib/market/market-seed";
import type { DashboardPayload } from "@/lib/types";

export function createPublicDashboard(email = ""): DashboardPayload {
  return {
    household: {
      id: "household_public",
      email,
      slug: "public",
      displayName: "로그인 필요",
      createdAt: "2026-03-10",
      updatedAt: "2026-03-10",
      storageMode: "supabase",
      targetMarketArea: "capital-area",
      audienceMode: "household-first",
    },
    financialSnapshot: null,
    housingGoal: null,
    latestPolicySnapshot: basePolicySnapshot,
    promotedMarkets: promotedMarketSnapshots,
    latestRun: null,
  };
}
