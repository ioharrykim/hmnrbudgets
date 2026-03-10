import { getRepository } from "@/lib/storage";

async function main() {
  const repository = getRepository();
  const result = await repository.refreshSnapshots();

  console.log(
    JSON.stringify(
      {
        policySnapshot: {
          id: result.policy.id,
          basisDate: result.policy.basisDate,
          publishedDate: result.policy.publishedDate,
        },
        marketSnapshots: result.markets.map((market) => ({
          id: market.id,
          regionName: market.regionName,
          publishedMonth: market.publishedMonth,
          freshness: market.freshness,
        })),
        reviews: result.reviews.map((review) => ({
          entityId: review.entityId,
          status: review.status,
          notes: review.notes,
        })),
      },
      null,
      2,
    ),
  );
}

void main();
