export type StorageMode = "demo-cookie" | "supabase";
export type ReviewStatus = "raw" | "normalized" | "reviewed" | "promoted";
export type MarketFreshness = "fresh" | "stale" | "pending";
export type ScenarioKey = "conservative" | "base" | "optimistic";
export type RegionSuitability = "affordable" | "stretch" | "longshot";

export interface SourceRecord {
  id: string;
  slug: string;
  title: string;
  publisher: string;
  url: string;
  retrievedAt: string;
  publishedAt?: string;
  effectiveDate?: string;
  notes?: string;
}

export interface RefreshReview {
  id: string;
  sourceRecordId: string;
  entityType: "market_snapshot" | "policy_snapshot";
  entityId: string;
  status: ReviewStatus;
  reviewedBy: string;
  reviewedAt?: string;
  notes?: string;
}

export interface Household {
  id: string;
  email: string;
  authUserId?: string;
  slug: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  storageMode: StorageMode;
  targetMarketArea: "capital-area";
  audienceMode: "household-first";
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  name: string;
  roleLabel: string;
  monthlyNetIncome: number;
  monthlyVariableIncome: number;
  employmentType: "employee" | "self-employed" | "contractor" | "other";
}

export interface FinancialSnapshot {
  id: string;
  householdId: string;
  capturedAt: string;
  members: HouseholdMember[];
  monthlyFixedExpenses: number;
  monthlyCurrentHousingCost: number;
  currentMonthlySavings: number;
  cashAssets: number;
  subscriptionSavings: number;
  jeonseReturnAmount: number;
  otherInvestableAssets: number;
  outstandingDebt: number;
  otherDebtMonthlyService: number;
  expectedAnnualBonus: number;
  notes?: string;
}

export interface HousingGoal {
  id: string;
  householdId: string;
  capturedAt: string;
  preferredRegions: string[];
  targetTimeframeMonths: number;
  commuteMaxMinutes: number;
  minimumExclusiveAreaM2: number;
  priorities: string[];
  notes?: string;
}

export interface PolicyLoanEligibility {
  product: "bogeumjari" | "didimdol";
  eligible: boolean;
  reason: string;
  maxLoanAmount: number;
  rate: number;
  ltvLimit: number;
  dtiLimit: number;
}

export interface PolicySnapshot {
  id: string;
  basisDate: string;
  publishedDate: string;
  reviewStatus: ReviewStatus;
  generalDsrLimit: number;
  capitalAreaStressDsrRate: number;
  nonCapitalStressDsrRate: number;
  assumedGeneralMortgageRate: number;
  closingCostRate: number;
  bogeumjari: {
    maxHousePrice: number;
    maxIncome: number;
    newlywedIncomeLimit: number;
    maxLoan: number;
    firstHomeMaxLoan: number;
    ltv: number;
    capitalAreaFirstHomeLtv: number;
    dti: number;
    baseRate: number;
    lowestPreferentialRate: number;
  };
  didimdol: {
    maxHousePrice: number;
    newlywedMaxHousePrice: number;
    maxIncome: number;
    firstHomeIncome: number;
    newlywedIncome: number;
    assetLimit: number;
    maxLoan: number;
    firstHomeMaxLoan: number;
    newlywedMaxLoan: number;
    ltv: number;
    dti: number;
    representativeRate: number;
  };
  sources: SourceRecord[];
}

export interface MarketSnapshot {
  id: string;
  slug: string;
  regionName: string;
  lifestyleLabel: string;
  publishedMonth: string;
  reviewStatus: ReviewStatus;
  freshness: MarketFreshness;
  priceBandLow: number;
  priceBandMid: number;
  priceBandHigh: number;
  momChangePct: number;
  yoyChangePct: number;
  commuteLabel: string;
  notes: string;
  sourceRecords: SourceRecord[];
}

export interface ScenarioResult {
  scenario: ScenarioKey;
  safeMaxPurchasePrice: number;
  totalRequiredCash: number;
  requiredSelfFunding: number;
  generalLoanCapacity: number;
  targetRegion: string;
  targetRegionMidPrice: number;
  monthsToGoal: number;
  additionalMonthlySavingsNeeded: number;
}

export interface MarketSuitabilityRecord {
  marketSnapshotId: string;
  regionName: string;
  targetPrice: number;
  requiredCash: number;
  projectedCashAtGoal: number;
  cashGap: number;
  estimatedMonthsToCloseGap: number;
  suitability: RegionSuitability;
  narrative: string;
}

export interface ActionPlanItem {
  id: string;
  horizon: "now" | "quarter" | "year";
  title: string;
  detail: string;
}

export interface ActionPlan {
  id: string;
  householdId: string;
  createdAt: string;
  items: ActionPlanItem[];
}

export interface AiInsight {
  summary: string;
  risks: string[];
  recommendedActions: string[];
  followUpQuestions: string[];
  provider: "openai" | "template";
}

export interface AffordabilityRun {
  id: string;
  householdId: string;
  computedAt: string;
  basisDate: string;
  policySnapshotId: string;
  marketSnapshotIds: string[];
  recognizedMonthlyIncome: number;
  safeMonthlyHousingBudget: number;
  totalAvailableOwnFunds: number;
  policyEligibility: PolicyLoanEligibility[];
  recommendedMarket: MarketSuitabilityRecord | null;
  marketSuitability: MarketSuitabilityRecord[];
  scenarios: Record<ScenarioKey, ScenarioResult>;
  actionPlan: ActionPlan;
  aiInsight: AiInsight;
  sourceRecords: SourceRecord[];
}

export interface DashboardPayload {
  household: Household;
  financialSnapshot: FinancialSnapshot | null;
  housingGoal: HousingGoal | null;
  latestPolicySnapshot: PolicySnapshot;
  promotedMarkets: MarketSnapshot[];
  latestRun: AffordabilityRun | null;
}

export interface InterviewQuestion {
  id: string;
  speaker: string;
  prompt: string;
  placeholder: string;
  kind: "money" | "number" | "text";
}

export interface InterviewAnswer {
  questionId: string;
  answer: string;
}

export interface InterviewDraft {
  householdName: string;
  financialSnapshot: FinancialSnapshot;
  housingGoal: HousingGoal;
  missingFields: string[];
  summary: string;
}
