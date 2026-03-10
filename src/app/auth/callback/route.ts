import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const redirectTo = new URL(next, origin);
  const response = NextResponse.redirect(redirectTo);
  const supabase = createSupabaseRouteHandlerClient(request, response);

  if (!supabase) {
    return response;
  }

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return response;
  }

  if (tokenHash && type) {
    await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
  }

  return response;
}
