export function hasSupabaseBrowserConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasSupabaseServerConfig() {
  return hasSupabaseBrowserConfig() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasOpenDataApiKey() {
  return Boolean(process.env.OPEN_DATA_API_KEY);
}
