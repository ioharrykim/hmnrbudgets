import { NextResponse } from "next/server";

import { DEMO_SESSION_COOKIE } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}
