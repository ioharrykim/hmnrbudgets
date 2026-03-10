import { NextResponse } from "next/server";

import { getConfiguredAuthMode } from "@/lib/env";
import { createPinSessionValue, getPinSessionCookieOptions, PIN_SESSION_COOKIE } from "@/lib/pin-auth";
import { getRepository } from "@/lib/storage";
import { pinLoginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (getConfiguredAuthMode() !== "pin") {
    return NextResponse.json({ error: "PIN 인증이 활성화되어 있지 않습니다." }, { status: 400 });
  }

  const payload = await request.json();
  const parsed = pinLoginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "이메일과 4자리 코드를 확인해주세요." }, { status: 400 });
  }

  if (parsed.data.pin !== process.env.HOUSEHOLD_ACCESS_PIN) {
    return NextResponse.json({ error: "접근코드가 올바르지 않습니다." }, { status: 401 });
  }

  const repository = getRepository();
  const household = await repository.getOrCreateHouseholdByEmail(parsed.data.email);
  const response = NextResponse.json({ household });
  response.cookies.set(PIN_SESSION_COOKIE, createPinSessionValue(parsed.data.email), getPinSessionCookieOptions());
  return response;
}
