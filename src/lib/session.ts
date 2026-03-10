import { cookies } from "next/headers";

import { DEFAULT_HOUSEHOLD_EMAIL, DEMO_SESSION_COOKIE } from "@/lib/constants";
import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionContext {
  email: string;
  authMode: "demo" | "supabase";
  authenticated: boolean;
  authUserId?: string;
}

export async function getSessionContext(): Promise<SessionContext> {
  if (hasSupabaseBrowserConfig()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        return {
          email: user.email,
          authMode: "supabase",
          authenticated: true,
          authUserId: user.id,
        };
      }
    }

    return {
      email: "",
      authMode: "supabase",
      authenticated: false,
    };
  }

  const store = await cookies();
  return {
    email: store.get(DEMO_SESSION_COOKIE)?.value ?? DEFAULT_HOUSEHOLD_EMAIL,
    authMode: "demo",
    authenticated: false,
  };
}

export async function getSessionEmail() {
  const session = await getSessionContext();
  return session.email;
}
