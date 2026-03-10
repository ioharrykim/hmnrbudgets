import { NextResponse, type NextRequest } from "next/server";

import { DEMO_SESSION_COOKIE } from "@/lib/constants";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = createSupabaseRouteHandlerClient(request, response);
  if (supabase) {
    await supabase.auth.signOut();
  }

  response.cookies.set(DEMO_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}
