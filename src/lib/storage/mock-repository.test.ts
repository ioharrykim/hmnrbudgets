import { MockRepository } from "@/lib/storage/mock-repository";

describe("MockRepository refresh pipeline", () => {
  it("creates reviewed snapshots and preserves pending freshness labels", async () => {
    const repository = new MockRepository();
    const result = await repository.refreshSnapshots();

    expect(result.reviews.length).toBeGreaterThan(1);
    expect(result.markets.some((market) => market.freshness === "pending")).toBe(true);
    expect(result.reviews.some((review) => review.notes?.includes("최신 발표 대기"))).toBe(true);
  });
});
