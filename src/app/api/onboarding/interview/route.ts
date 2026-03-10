import { NextResponse } from "next/server";

import { UnauthorizedSessionError, requireHouseholdSession } from "@/lib/household-session";
import { normalizeInterviewAnswers } from "@/lib/interview/normalize";
import { interviewPayloadSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = interviewPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "인터뷰 답변 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const { household } = await requireHouseholdSession();
    const draft = normalizeInterviewAnswers(household.id, parsed.data.answers, household.displayName);

    return NextResponse.json({ household, draft });
  } catch (error) {
    if (error instanceof UnauthorizedSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    throw error;
  }
}
