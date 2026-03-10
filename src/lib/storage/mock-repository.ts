import { DEFAULT_DATE, DEFAULT_HOUSEHOLD_EMAIL, DEFAULT_HOUSEHOLD_NAME } from "@/lib/constants";
import { hasOpenDataApiKey } from "@/lib/env";
import { refreshMarketSnapshotsFromMolit } from "@/lib/market/molit";
import { promotedMarketSnapshots } from "@/lib/market/market-seed";
import { basePolicySnapshot } from "@/lib/policy/policy-seed";
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
import { slugify, makeId, nowIso } from "@/lib/utils";
import type { PersistenceRepository } from "@/lib/storage/types";

type Store = {
  households: Map<string, Household>;
  householdsByEmail: Map<string, string>;
  financialSnapshots: Map<string, FinancialSnapshot>;
  housingGoals: Map<string, HousingGoal>;
  runs: Map<string, AffordabilityRun>;
  policySnapshot: PolicySnapshot;
  marketSnapshots: MarketSnapshot[];
  reviews: RefreshReview[];
};

const globalStoreKey = "__hmnr_demo_store__";

function createSeedHousehold(): Household {
  return {
    id: "household_demo",
    email: DEFAULT_HOUSEHOLD_EMAIL,
    authUserId: undefined,
    slug: slugify(DEFAULT_HOUSEHOLD_NAME),
    displayName: DEFAULT_HOUSEHOLD_NAME,
    createdAt: DEFAULT_DATE,
    updatedAt: DEFAULT_DATE,
    storageMode: "demo-cookie",
    targetMarketArea: "capital-area",
    audienceMode: "household-first",
  };
}

function initStore(): Store {
  const demoHousehold = createSeedHousehold();
  return {
    households: new Map([[demoHousehold.id, demoHousehold]]),
    householdsByEmail: new Map([[demoHousehold.email, demoHousehold.id]]),
    financialSnapshots: new Map(),
    housingGoals: new Map(),
    runs: new Map(),
    policySnapshot: basePolicySnapshot,
    marketSnapshots: promotedMarketSnapshots,
    reviews: [],
  };
}

function getStore(): Store {
  const globalObject = globalThis as typeof globalThis & { [globalStoreKey]?: Store };
  if (!globalObject[globalStoreKey]) {
    globalObject[globalStoreKey] = initStore();
  }

  return globalObject[globalStoreKey];
}

export class MockRepository implements PersistenceRepository {
  async getOrCreateHouseholdByEmail(email: string, authUserId?: string) {
    const store = getStore();
    const normalizedEmail = email.trim().toLowerCase();
    const existingId = store.householdsByEmail.get(normalizedEmail);

    if (existingId) {
      const existing = store.households.get(existingId)!;
      if (authUserId && existing.authUserId && existing.authUserId !== authUserId) {
        throw new Error("세션 사용자와 household 소유자가 다릅니다.");
      }

      if (authUserId && !existing.authUserId) {
        const updated = {
          ...existing,
          authUserId,
          updatedAt: nowIso(),
        };
        store.households.set(existing.id, updated);
        return updated;
      }

      return existing;
    }

    const household: Household = {
      id: makeId("household"),
      email: normalizedEmail,
      authUserId,
      slug: slugify(normalizedEmail.split("@")[0]),
      displayName: DEFAULT_HOUSEHOLD_NAME,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      storageMode: "demo-cookie",
      targetMarketArea: "capital-area",
      audienceMode: "household-first",
    };

    store.households.set(household.id, household);
    store.householdsByEmail.set(normalizedEmail, household.id);
    return household;
  }

  async getHouseholdById(householdId: string) {
    return getStore().households.get(householdId) ?? null;
  }

  async getLatestFinancialSnapshot(householdId: string) {
    return getStore().financialSnapshots.get(householdId) ?? null;
  }

  async upsertFinancialSnapshot(snapshot: FinancialSnapshot) {
    getStore().financialSnapshots.set(snapshot.householdId, snapshot);
    return snapshot;
  }

  async getHousingGoal(householdId: string) {
    return getStore().housingGoals.get(householdId) ?? null;
  }

  async upsertHousingGoal(goal: HousingGoal) {
    getStore().housingGoals.set(goal.householdId, goal);
    return goal;
  }

  async getLatestRun(householdId: string) {
    return getStore().runs.get(householdId) ?? null;
  }

  async saveAffordabilityRun(run: AffordabilityRun) {
    getStore().runs.set(run.householdId, run);
    return run;
  }

  async getPromotedPolicySnapshot() {
    return getStore().policySnapshot;
  }

  async getPromotedMarketSnapshots() {
    return getStore().marketSnapshots;
  }

  async refreshSnapshots() {
    const store = getStore();
    if (hasOpenDataApiKey()) {
      try {
        const refreshed = await refreshMarketSnapshotsFromMolit(store.policySnapshot.basisDate);
        store.marketSnapshots = refreshed.markets;
        const reviewedPolicy = {
          ...store.policySnapshot,
          reviewStatus: "reviewed" as const,
        };
        store.policySnapshot = reviewedPolicy;
        const policyReview = {
          id: makeId("review"),
          sourceRecordId: reviewedPolicy.sources[0].id,
          entityType: "policy_snapshot" as const,
          entityId: reviewedPolicy.id,
          status: "reviewed" as const,
          reviewedBy: "policy-curation",
          reviewedAt: nowIso(),
          notes: "정책 스냅샷은 수동 검수 기준값 유지",
        };
        store.reviews = [policyReview, ...refreshed.reviews];

        return {
          policy: reviewedPolicy,
          markets: refreshed.markets,
          reviews: store.reviews,
        };
      } catch {
        // Fall back to the seeded snapshots below if the live refresh fails.
      }
    }

    const reviews = [
      {
        id: makeId("review"),
        sourceRecordId: store.policySnapshot.sources[0].id,
        entityType: "policy_snapshot" as const,
        entityId: store.policySnapshot.id,
        status: "reviewed" as const,
        reviewedBy: "system-refresh",
        reviewedAt: nowIso(),
        notes: "기준 데이터 재검토 완료",
      },
      ...store.marketSnapshots.map((market) => ({
        id: makeId("review"),
        sourceRecordId: market.sourceRecords[0].id,
        entityType: "market_snapshot" as const,
        entityId: market.id,
        status: "reviewed" as const,
        reviewedBy: "system-refresh",
        reviewedAt: nowIso(),
        notes: market.freshness === "pending" ? "공식 최신 발표 대기 중" : "검수 완료",
      })),
    ];
    store.reviews = reviews;

    return {
      policy: store.policySnapshot,
      markets: store.marketSnapshots,
      reviews,
    };
  }

  async promoteReviewedSnapshots() {
    const store = getStore();
    store.policySnapshot = {
      ...store.policySnapshot,
      reviewStatus: "promoted",
    };
    store.marketSnapshots = store.marketSnapshots.map((market) => ({
      ...market,
      reviewStatus: "promoted",
    }));
    return {
      promotedPolicy: store.policySnapshot,
      promotedMarkets: store.marketSnapshots,
    };
  }

  async getDashboardPayload(householdId: string): Promise<DashboardPayload | null> {
    const store = getStore();
    const household = store.households.get(householdId);
    if (!household) {
      return null;
    }

    return {
      household,
      financialSnapshot: store.financialSnapshots.get(householdId) ?? null,
      housingGoal: store.housingGoals.get(householdId) ?? null,
      latestPolicySnapshot: store.policySnapshot,
      promotedMarkets: store.marketSnapshots,
      latestRun: store.runs.get(householdId) ?? null,
    };
  }
}
