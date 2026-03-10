import { getRepository } from "@/lib/storage";

async function main() {
  const repository = getRepository();
  const result = await repository.promoteReviewedSnapshots();

  console.log(
    JSON.stringify(
      {
        promotedPolicy: result.promotedPolicy.id,
        promotedMarkets: result.promotedMarkets.map((market) => market.id),
      },
      null,
      2,
    ),
  );
}

void main();
