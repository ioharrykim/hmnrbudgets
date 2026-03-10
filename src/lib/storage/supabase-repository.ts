import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { hasOpenDataApiKey } from "@/lib/env";
import { refreshMarketSnapshotsFromMolit } from "@/lib/market/molit";
import { basePolicySnapshot } from "@/lib/policy/policy-seed";
import { promotedMarketSnapshots } from "@/lib/market/market-seed";
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
import type { PersistenceRepository } from "@/lib/storage/types";
import { nowIso, slugify } from "@/lib/utils";

function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function mapHousehold(record: Record<string, unknown>): Household {
  return {
    id: String(record.id),
    email: String(record.email),
    authUserId: (record.auth_user_id as string | null) ?? undefined,
    slug: String(record.slug),
    displayName: String(record.display_name),
    createdAt: String(record.created_at),
    updatedAt: String(record.updated_at),
    storageMode: record.storage_mode as Household["storageMode"],
    targetMarketArea: record.target_market_area as Household["targetMarketArea"],
    audienceMode: record.audience_mode as Household["audienceMode"],
  };
}

function mapPolicySnapshot(record: Record<string, unknown>): PolicySnapshot {
  return {
    id: String(record.id),
    basisDate: String(record.basis_date),
    publishedDate: String(record.published_date),
    reviewStatus: record.review_status as PolicySnapshot["reviewStatus"],
    generalDsrLimit: Number(record.general_dsr_limit),
    capitalAreaStressDsrRate: Number(record.capital_area_stress_dsr_rate),
    nonCapitalStressDsrRate: Number(record.non_capital_stress_dsr_rate),
    assumedGeneralMortgageRate: Number(record.assumed_general_mortgage_rate),
    closingCostRate: Number(record.closing_cost_rate),
    bogeumjari: record.bogeumjari as PolicySnapshot["bogeumjari"],
    didimdol: record.didimdol as PolicySnapshot["didimdol"],
    sources: record.sources as PolicySnapshot["sources"],
  };
}

function mapMarketSnapshot(record: Record<string, unknown>): MarketSnapshot {
  return {
    id: String(record.id),
    slug: String(record.slug),
    regionName: String(record.region_name),
    lifestyleLabel: String(record.lifestyle_label),
    publishedMonth: String(record.published_month),
    reviewStatus: record.review_status as MarketSnapshot["reviewStatus"],
    freshness: record.freshness as MarketSnapshot["freshness"],
    priceBandLow: Number(record.price_band_low),
    priceBandMid: Number(record.price_band_mid),
    priceBandHigh: Number(record.price_band_high),
    momChangePct: Number(record.mom_change_pct),
    yoyChangePct: Number(record.yoy_change_pct),
    commuteLabel: String(record.commute_label),
    notes: String(record.notes),
    sourceRecords: record.source_records as MarketSnapshot["sourceRecords"],
  };
}

function mapRun(record: Record<string, unknown>): AffordabilityRun {
  return {
    id: String(record.id),
    householdId: String(record.household_id),
    computedAt: String(record.computed_at),
    basisDate: String(record.basis_date),
    policySnapshotId: String(record.policy_snapshot_id),
    marketSnapshotIds: record.market_snapshot_ids as string[],
    recognizedMonthlyIncome: Number(record.recognized_monthly_income),
    safeMonthlyHousingBudget: Number(record.safe_monthly_housing_budget),
    totalAvailableOwnFunds: Number(record.total_available_own_funds),
    policyEligibility: record.policy_eligibility as AffordabilityRun["policyEligibility"],
    recommendedMarket: record.recommended_market as AffordabilityRun["recommendedMarket"],
    marketSuitability: record.market_suitability as AffordabilityRun["marketSuitability"],
    scenarios: record.scenarios as AffordabilityRun["scenarios"],
    actionPlan: record.action_plan as AffordabilityRun["actionPlan"],
    aiInsight: record.ai_insight as AffordabilityRun["aiInsight"],
    sourceRecords: record.source_records as AffordabilityRun["sourceRecords"],
  };
}

function mapFinancialSnapshot(record: Record<string, unknown>): FinancialSnapshot {
  return {
    id: String(record.id),
    householdId: String(record.household_id),
    capturedAt: String(record.captured_at),
    members: record.members as FinancialSnapshot["members"],
    monthlyFixedExpenses: Number(record.monthly_fixed_expenses),
    monthlyCurrentHousingCost: Number(record.monthly_current_housing_cost),
    currentMonthlySavings: Number(record.current_monthly_savings),
    cashAssets: Number(record.cash_assets),
    subscriptionSavings: Number(record.subscription_savings),
    jeonseReturnAmount: Number(record.jeonse_return_amount),
    otherInvestableAssets: Number(record.other_investable_assets),
    outstandingDebt: Number(record.outstanding_debt),
    otherDebtMonthlyService: Number(record.other_debt_monthly_service),
    expectedAnnualBonus: Number(record.expected_annual_bonus),
    notes: (record.notes as string | null) ?? undefined,
  };
}

function mapHousingGoal(record: Record<string, unknown>): HousingGoal {
  return {
    id: String(record.id),
    householdId: String(record.household_id),
    capturedAt: String(record.captured_at),
    preferredRegions: record.preferred_regions as string[],
    targetTimeframeMonths: Number(record.target_timeframe_months),
    commuteMaxMinutes: Number(record.commute_max_minutes),
    minimumExclusiveAreaM2: Number(record.minimum_exclusive_area_m2),
    priorities: record.priorities as string[],
    notes: (record.notes as string | null) ?? undefined,
  };
}

export class SupabaseRepository implements PersistenceRepository {
  private client: SupabaseClient;

  constructor() {
    this.client = createSupabaseAdminClient();
  }

  async getOrCreateHouseholdByEmail(email: string, authUserId?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    let existing: Record<string, unknown> | null = null;

    if (authUserId) {
      const { data } = await this.client
        .from("households")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      existing = data;
    }

    if (!existing) {
      const { data } = await this.client
        .from("households")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      const mapped = mapHousehold(existing);
      if (authUserId && mapped.authUserId && mapped.authUserId !== authUserId) {
        throw new Error("세션 사용자와 household 소유자가 다릅니다.");
      }

      if (authUserId && !mapped.authUserId) {
        const updated = {
          ...mapped,
          authUserId,
          updatedAt: nowIso(),
        };
        await this.client
          .from("households")
          .update({
            auth_user_id: updated.authUserId,
            updated_at: updated.updatedAt,
          })
          .eq("id", updated.id);
        return updated;
      }

      return mapped;
    }

    const household: Household = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      authUserId,
      slug: slugify(normalizedEmail.split("@")[0]),
      displayName: "현민 · 누리",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      storageMode: "supabase",
      targetMarketArea: "capital-area",
      audienceMode: "household-first",
    };

    await this.client.from("households").insert({
      id: household.id,
      email: household.email,
      auth_user_id: household.authUserId ?? null,
      slug: household.slug,
      display_name: household.displayName,
      created_at: household.createdAt,
      updated_at: household.updatedAt,
      storage_mode: household.storageMode,
      target_market_area: household.targetMarketArea,
      audience_mode: household.audienceMode,
    });
    return household;
  }

  async getHouseholdById(householdId: string) {
    const { data } = await this.client.from("households").select("*").eq("id", householdId).maybeSingle();
    return data ? mapHousehold(data) : null;
  }

  async getLatestFinancialSnapshot(householdId: string) {
    const { data } = await this.client
      .from("financial_snapshots")
      .select("*")
      .eq("household_id", householdId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? mapFinancialSnapshot(data) : null;
  }

  async upsertFinancialSnapshot(snapshot: FinancialSnapshot) {
    await this.client.from("financial_snapshots").upsert({
      id: snapshot.id,
      household_id: snapshot.householdId,
      captured_at: snapshot.capturedAt,
      members: snapshot.members,
      monthly_fixed_expenses: snapshot.monthlyFixedExpenses,
      monthly_current_housing_cost: snapshot.monthlyCurrentHousingCost,
      current_monthly_savings: snapshot.currentMonthlySavings,
      cash_assets: snapshot.cashAssets,
      subscription_savings: snapshot.subscriptionSavings,
      jeonse_return_amount: snapshot.jeonseReturnAmount,
      other_investable_assets: snapshot.otherInvestableAssets,
      outstanding_debt: snapshot.outstandingDebt,
      other_debt_monthly_service: snapshot.otherDebtMonthlyService,
      expected_annual_bonus: snapshot.expectedAnnualBonus,
      notes: snapshot.notes ?? null,
    });

    return snapshot;
  }

  async getHousingGoal(householdId: string) {
    const { data } = await this.client
      .from("housing_goals")
      .select("*")
      .eq("household_id", householdId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? mapHousingGoal(data) : null;
  }

  async upsertHousingGoal(goal: HousingGoal) {
    await this.client.from("housing_goals").upsert({
      id: goal.id,
      household_id: goal.householdId,
      captured_at: goal.capturedAt,
      preferred_regions: goal.preferredRegions,
      target_timeframe_months: goal.targetTimeframeMonths,
      commute_max_minutes: goal.commuteMaxMinutes,
      minimum_exclusive_area_m2: goal.minimumExclusiveAreaM2,
      priorities: goal.priorities,
      notes: goal.notes ?? null,
    });

    return goal;
  }

  async getLatestRun(householdId: string) {
    const { data } = await this.client
      .from("affordability_runs")
      .select("*")
      .eq("household_id", householdId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? mapRun(data) : null;
  }

  async saveAffordabilityRun(run: AffordabilityRun) {
    await this.client.from("affordability_runs").upsert({
      id: run.id,
      household_id: run.householdId,
      computed_at: run.computedAt,
      basis_date: run.basisDate,
      policy_snapshot_id: run.policySnapshotId,
      market_snapshot_ids: run.marketSnapshotIds,
      recognized_monthly_income: run.recognizedMonthlyIncome,
      safe_monthly_housing_budget: run.safeMonthlyHousingBudget,
      total_available_own_funds: run.totalAvailableOwnFunds,
      policy_eligibility: run.policyEligibility,
      recommended_market: run.recommendedMarket,
      market_suitability: run.marketSuitability,
      scenarios: run.scenarios,
      action_plan: run.actionPlan,
      ai_insight: run.aiInsight,
      source_records: run.sourceRecords,
    });

    return run;
  }

  async getPromotedPolicySnapshot() {
    const { data } = await this.client
      .from("policy_snapshots")
      .select("*")
      .eq("review_status", "promoted")
      .order("published_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? mapPolicySnapshot(data) : basePolicySnapshot;
  }

  async getPromotedMarketSnapshots() {
    const { data } = await this.client
      .from("market_snapshots")
      .select("*")
      .eq("review_status", "promoted")
      .order("price_band_mid", { ascending: true });

    return data && data.length > 0 ? data.map((record) => mapMarketSnapshot(record)) : promotedMarketSnapshots;
  }

  async refreshSnapshots() {
    const policy = {
      ...(await this.getPromotedPolicySnapshot()),
      reviewStatus: "reviewed" as const,
    };
    let markets = await this.getPromotedMarketSnapshots();
    let reviews: RefreshReview[] = [
      {
        id: crypto.randomUUID(),
        sourceRecordId: policy.sources[0]?.id ?? "policy_manual_review",
        entityType: "policy_snapshot",
        entityId: policy.id,
        status: "reviewed",
        reviewedBy: "policy-curation",
        reviewedAt: nowIso(),
        notes: "정책 스냅샷은 수동 검수 기준값 유지",
      },
    ];

    if (hasOpenDataApiKey()) {
      try {
        const refreshed = await refreshMarketSnapshotsFromMolit(policy.basisDate);
        markets = refreshed.markets;
        reviews = [...reviews, ...refreshed.reviews];
      } catch {
        reviews[0] = {
          ...reviews[0],
          notes: "정책 스냅샷 유지, 시장 live refresh 실패로 직전 promoted 값 사용",
        };
      }
    }

    await this.client.from("policy_snapshots").upsert({
      id: policy.id,
      basis_date: policy.basisDate,
      published_date: policy.publishedDate,
      review_status: policy.reviewStatus,
      general_dsr_limit: policy.generalDsrLimit,
      capital_area_stress_dsr_rate: policy.capitalAreaStressDsrRate,
      non_capital_stress_dsr_rate: policy.nonCapitalStressDsrRate,
      assumed_general_mortgage_rate: policy.assumedGeneralMortgageRate,
      closing_cost_rate: policy.closingCostRate,
      bogeumjari: policy.bogeumjari,
      didimdol: policy.didimdol,
      sources: policy.sources,
    });

    if (markets.length > 0) {
      await this.client.from("market_snapshots").upsert(
        markets.map((market) => ({
          id: market.id,
          slug: market.slug,
          region_name: market.regionName,
          lifestyle_label: market.lifestyleLabel,
          published_month: market.publishedMonth,
          review_status: market.reviewStatus,
          freshness: market.freshness,
          price_band_low: market.priceBandLow,
          price_band_mid: market.priceBandMid,
          price_band_high: market.priceBandHigh,
          mom_change_pct: market.momChangePct,
          yoy_change_pct: market.yoyChangePct,
          commute_label: market.commuteLabel,
          notes: market.notes,
          source_records: market.sourceRecords,
        })),
      );
    }

    if (reviews.length > 0) {
      await this.client.from("refresh_reviews").upsert(
        reviews.map((review) => ({
          id: review.id,
          source_record_id: review.sourceRecordId,
          entity_type: review.entityType,
          entity_id: review.entityId,
          status: review.status,
          reviewed_by: review.reviewedBy,
          reviewed_at: review.reviewedAt ?? null,
          notes: review.notes ?? null,
        })),
      );
    }

    return {
      policy,
      markets,
      reviews,
    };
  }

  async promoteReviewedSnapshots() {
    const { policy, markets } = await this.refreshSnapshots();
    const promotedPolicy = {
      ...policy,
      reviewStatus: "promoted" as const,
    };
    const promotedMarkets = markets.map((market) => ({
      ...market,
      reviewStatus: "promoted" as const,
    }));

    await this.client.from("policy_snapshots").upsert({
      id: promotedPolicy.id,
      basis_date: promotedPolicy.basisDate,
      published_date: promotedPolicy.publishedDate,
      review_status: promotedPolicy.reviewStatus,
      general_dsr_limit: promotedPolicy.generalDsrLimit,
      capital_area_stress_dsr_rate: promotedPolicy.capitalAreaStressDsrRate,
      non_capital_stress_dsr_rate: promotedPolicy.nonCapitalStressDsrRate,
      assumed_general_mortgage_rate: promotedPolicy.assumedGeneralMortgageRate,
      closing_cost_rate: promotedPolicy.closingCostRate,
      bogeumjari: promotedPolicy.bogeumjari,
      didimdol: promotedPolicy.didimdol,
      sources: promotedPolicy.sources,
    });

    if (promotedMarkets.length > 0) {
      await this.client.from("market_snapshots").upsert(
        promotedMarkets.map((market) => ({
          id: market.id,
          slug: market.slug,
          region_name: market.regionName,
          lifestyle_label: market.lifestyleLabel,
          published_month: market.publishedMonth,
          review_status: market.reviewStatus,
          freshness: market.freshness,
          price_band_low: market.priceBandLow,
          price_band_mid: market.priceBandMid,
          price_band_high: market.priceBandHigh,
          mom_change_pct: market.momChangePct,
          yoy_change_pct: market.yoyChangePct,
          commute_label: market.commuteLabel,
          notes: market.notes,
          source_records: market.sourceRecords,
        })),
      );
    }

    return {
      promotedPolicy,
      promotedMarkets,
    };
  }

  async getDashboardPayload(householdId: string): Promise<DashboardPayload | null> {
    const [household, financialSnapshot, housingGoal, latestRun, latestPolicySnapshot, promotedMarkets] =
      await Promise.all([
        this.getHouseholdById(householdId),
        this.getLatestFinancialSnapshot(householdId),
        this.getHousingGoal(householdId),
        this.getLatestRun(householdId),
        this.getPromotedPolicySnapshot(),
        this.getPromotedMarketSnapshots(),
      ]);

    if (!household) {
      return null;
    }

    return {
      household,
      financialSnapshot,
      housingGoal,
      latestRun,
      latestPolicySnapshot,
      promotedMarkets,
    };
  }
}
