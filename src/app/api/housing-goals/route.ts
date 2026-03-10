import { NextResponse } from "next/server";

import { UnauthorizedSessionError, requireHouseholdSession } from "@/lib/household-session";
import { housingGoalSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = housingGoalSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "주거 목표 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const { repository, household } = await requireHouseholdSession();

    if (parsed.data.householdId !== household.id) {
      return NextResponse.json({ error: "세션 household와 요청 household가 다릅니다." }, { status: 403 });
    }

    const goal = await repository.upsertHousingGoal(parsed.data);
    return NextResponse.json({ goal });
  } catch (error) {
    if (error instanceof UnauthorizedSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "주거 목표 저장 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
