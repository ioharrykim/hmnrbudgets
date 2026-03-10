import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { hasSupabaseBrowserConfig } from "@/lib/env";
import { sessionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.json({ error: "Supabase 인증이 구성되지 않았습니다." }, { status: 400 });
  }

  const payload = await request.json();
  const parsed = sessionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "유효한 이메일이 필요합니다." }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
