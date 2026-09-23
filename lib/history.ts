import type { SupabaseClient } from "@supabase/supabase-js";
import type { PastSessionSummary } from "./gemini";

/** Pulls this couple's past matches + ratings (keyed by device pair) to feed Claude's
 * taste-summary step. Best-effort: returns [] for first-time pairs or on any lookup gaps. */
export async function getPairHistory(
  supabase: SupabaseClient,
  pairKey: string,
  excludeSessionId: string
): Promise<PastSessionSummary[]> {
  const { data: pastSessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("pair_key", pairKey)
    .neq("id", excludeSessionId)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!pastSessions || pastSessions.length === 0) return [];
  const sessionIds = pastSessions.map((s) => s.id as string);

  const [{ data: matches }, { data: ratings }, { data: poolTitles }] = await Promise.all([
    supabase.from("matches").select("*").in("session_id", sessionIds),
    supabase.from("ratings").select("*").in("session_id", sessionIds),
    supabase.from("pool_titles").select("*").in("session_id", sessionIds),
  ]);

  const titleLookup = new Map(
    (poolTitles ?? []).map((p) => [`${p.session_id}:${p.round}:${p.media_type}:${p.tmdb_id}`, p.title as string])
  );

  return sessionIds.map((sessionId) => {
    const match = (matches ?? []).find((m) => m.session_id === sessionId);
    const rating = (ratings ?? []).find((r) => r.session_id === sessionId);
    const matchedTitle = match
      ? titleLookup.get(`${sessionId}:${match.round}:${match.media_type}:${match.tmdb_id}`) ?? null
      : null;

    return {
      matchedTitle,
      rating: rating?.stars ?? null,
      likedTitles: matchedTitle ? [matchedTitle] : [],
    };
  });
}
