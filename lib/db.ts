import { createClient } from "@supabase/supabase-js";

const URL =
  process.env.SUPABASE_URL ??
  (process.env.SUPABASE_PROJECT_ID
    ? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`
    : undefined);

/**
 * Server-only. Uses the secret key, which bypasses RLS. Never import from a
 * client component.
 */
export function db() {
  const key = process.env.SUPABASE_API_KEY;
  if (!URL || !key) return null;
  return createClient(URL, key, { auth: { persistSession: false } });
}
