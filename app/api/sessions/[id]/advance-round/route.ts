import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import { refineFromLikes, type LikedTitleSummary } from "@/lib/gemini";
import { buildPool, reconcileMediaTypes } from "@/lib/pool";
import type { PreferenceInput, PreferenceRow, PoolTitleRow, SwipeRow } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = z.object({
  deviceId: z.string().uuid(),
});

function rowToInput(row: PreferenceRow): PreferenceInput {
  return {
    moods: row.moods,
    moodText: row.mood_text,
    languages: row.languages,
    contentType: row.content_type,
    minRating: row.min_rating,
    eras: row.eras,
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: session } = await supabase.from("sessions").select("*").eq("id", id).single();
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  if (session.device_a_id !== parsed.data.deviceId && session.device_b_id !== parsed.data.deviceId) {
    return NextResponse.json({ error: "This device is not part of the session." }, { status: 403 });
  }

  if (session.status !== "swiping" || session.round !== 1) {
    // Already advanced (or matched) by the other partner's request — just report current state.
    return NextResponse.json({ session });
  }

  // Atomic claim: only the first request to land wins the race between both partners' clients.
  const { data: claimed } = await supabase
    .from("sessions")
    .update({ status: "generating_pool" })
    .eq("id", id)
    .eq("status", "swiping")
    .eq("round", 1)
    .select()
    .maybeSingle();

  if (!claimed) {
    const { data: current } = await supabase.from("sessions").select("*").eq("id", id).single();
    return NextResponse.json({ session: current });
  }

  try {
    const [{ data: allPrefs }, { data: round1Pool }, { data: round1Swipes }] = await Promise.all([
      supabase.from("preferences").select("*").eq("session_id", id),
      supabase.from("pool_titles").select("*").eq("session_id", id).eq("round", 1),
      supabase.from("swipes").select("*").eq("session_id", id).eq("round", 1).eq("direction", "right"),
    ]);

    const prefsA = (allPrefs as PreferenceRow[]).find((r) => r.partner === "a")!;
    const prefsB = (allPrefs as PreferenceRow[]).find((r) => r.partner === "b")!;
    const pool = round1Pool as PoolTitleRow[];
    const swipes = round1Swipes as SwipeRow[];

    const likedByTitle = new Map<string, LikedTitleSummary>();
    for (const swipe of swipes) {
      const title = pool.find((p) => p.tmdb_id === swipe.tmdb_id && p.media_type === swipe.media_type);
      if (!title) continue;
      const key = `${swipe.media_type}:${swipe.tmdb_id}`;
      const existing = likedByTitle.get(key);
      if (existing) {
        existing.likedBy.push(swipe.partner);
      } else {
        likedByTitle.set(key, {
          title: title.title,
          genres: title.genres,
          synopsis: title.synopsis ?? "",
          likedBy: [swipe.partner],
        });
      }
    }

    const inputA = rowToInput(prefsA);
    const inputB = rowToInput(prefsB);
    const brief = await refineFromLikes(inputA, inputB, Array.from(likedByTitle.values()));
    const mediaTypes = reconcileMediaTypes(inputA.contentType, inputB.contentType);
    const excludeTmdbIds = pool.map((p) => ({ mediaType: p.media_type, tmdbId: p.tmdb_id }));

    const titles = await buildPool({ brief, mediaTypes, excludeTmdbIds });

    if (titles.length === 0) {
      await supabase.from("sessions").update({ status: "swiping" }).eq("id", id);
      return NextResponse.json({ error: "Couldn't find new titles for round 2." }, { status: 422 });
    }

    await supabase.from("pool_titles").insert(titles.map((t) => ({ ...t, session_id: id, round: 2 })));
    const { data: updated } = await supabase
      .from("sessions")
      .update({ status: "swiping", round: 2 })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json({ session: updated });
  } catch (err) {
    await supabase.from("sessions").update({ status: "swiping" }).eq("id", id);
    const message = err instanceof Error ? err.message : "Failed to generate round 2.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
