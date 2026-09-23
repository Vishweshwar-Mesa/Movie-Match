import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Browser-safe client (anon key) — used for realtime subscriptions and reads. */
export function getBrowserSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
  }
  return createClient(url, anonKey);
}

/** Server-only client (service role key) — used in API route handlers to write data. */
export function getServerSupabase(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

/** Sorted, order-independent key identifying a device pair, used for couple history lookups. */
export function makePairKey(deviceAId: string, deviceBId: string): string {
  return [deviceAId, deviceBId].sort().join("_");
}
