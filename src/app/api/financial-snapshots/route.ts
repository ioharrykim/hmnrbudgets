import { NextResponse } from "next/server";

import { UnauthorizedSessionError, requireHouseholdSession } from "@/lib/household-session";
import { financialSnapshotSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = financialSnapshotSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "재무 스냅샷 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const { repository, household } = await requireHouseholdSession();

    if (parsed.data.householdId !== household.id) {
      return NextResponse.json({ error: "세션 household와 요청 household가 다릅니다." }, { status: 403 });
    }

    const snapshot = await repository.upsertFinancialSnapshot(parsed.data);
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof UnauthorizedSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    throw error;
  }
}
