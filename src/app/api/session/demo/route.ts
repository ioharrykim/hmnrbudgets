import { NextResponse } from "next/server";

import { DEMO_SESSION_COOKIE } from "@/lib/constants";
import { hasSupabaseBrowserConfig } from "@/lib/env";
import { getRepository } from "@/lib/storage";
import { sessionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (hasSupabaseBrowserConfig()) {
    return NextResponse.json(
      { error: "Supabase 인증이 설정된 환경에서는 demo 세션을 사용할 수 없습니다." },
      { status: 403 },
    );
  }

  const payload = await request.json();
  const parsed = sessionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "유효한 이메일이 필요합니다." }, { status: 400 });
  }

  const repository = getRepository();
  const household = await repository.getOrCreateHouseholdByEmail(parsed.data.email);

  const response = NextResponse.json({ household });
  response.cookies.set(DEMO_SESSION_COOKIE, household.email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
