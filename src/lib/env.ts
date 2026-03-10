export function hasPinAuthConfig() {
  return Boolean(process.env.HOUSEHOLD_ACCESS_PIN && process.env.SESSION_SIGNING_SECRET);
}

export function hasSupabaseBrowserConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasSupabaseServerConfig() {
  return hasSupabaseBrowserConfig() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasOpenDataApiKey() {
  return Boolean(process.env.OPEN_DATA_API_KEY);
}

export function getConfiguredAuthMode(): "pin" | "supabase" | "demo" {
  if (hasPinAuthConfig()) {
    return "pin";
  }

  if (hasSupabaseBrowserConfig()) {
    return "supabase";
  }

  return "demo";
}
