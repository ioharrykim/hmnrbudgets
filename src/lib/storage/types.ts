import type {
  AffordabilityRun,
  DashboardPayload,
  FinancialSnapshot,
  Household,
  HousingGoal,
  MarketSnapshot,
  PolicySnapshot,
  RefreshReview,
} from "@/lib/types";

export interface PersistenceRepository {
  getOrCreateHouseholdByEmail(email: string, authUserId?: string): Promise<Household>;
  getHouseholdById(householdId: string): Promise<Household | null>;
  getLatestFinancialSnapshot(householdId: string): Promise<FinancialSnapshot | null>;
  upsertFinancialSnapshot(snapshot: FinancialSnapshot): Promise<FinancialSnapshot>;
  getHousingGoal(householdId: string): Promise<HousingGoal | null>;
  upsertHousingGoal(goal: HousingGoal): Promise<HousingGoal>;
  getLatestRun(householdId: string): Promise<AffordabilityRun | null>;
  saveAffordabilityRun(run: AffordabilityRun): Promise<AffordabilityRun>;
  getPromotedPolicySnapshot(): Promise<PolicySnapshot>;
  getPromotedMarketSnapshots(): Promise<MarketSnapshot[]>;
  refreshSnapshots(): Promise<{ policy: PolicySnapshot; markets: MarketSnapshot[]; reviews: RefreshReview[] }>;
  promoteReviewedSnapshots(): Promise<{ promotedPolicy: PolicySnapshot; promotedMarkets: MarketSnapshot[] }>;
  getDashboardPayload(householdId: string): Promise<DashboardPayload | null>;
}
