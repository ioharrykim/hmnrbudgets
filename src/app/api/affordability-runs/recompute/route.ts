import { NextResponse } from "next/server";

import { recomputeHouseholdRun } from "@/lib/dashboard";
import { UnauthorizedSessionError, requireHouseholdSession } from "@/lib/household-session";

export async function POST() {
  try {
    const { household } = await requireHouseholdSession();
    const run = await recomputeHouseholdRun(household.id);

    if (!run) {
      return NextResponse.json(
        { error: "재무 스냅샷과 주거 목표를 먼저 저장해야 합니다." },
        { status: 400 },
      );
    }

    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof UnauthorizedSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    throw error;
  }
}
