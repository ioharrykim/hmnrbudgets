import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { hasSupabaseBrowserConfig } from "@/lib/env";

export async function createSupabaseServerClient() {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot always write cookies. Middleware handles refresh.
        }
      },
    },
  });
}
