import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import { buildBrief, summarizeTaste } from "@/lib/gemini";
import { buildPool, reconcileMediaTypes } from "@/lib/pool";
import { getPairHistory } from "@/lib/history";
import type { PreferenceInput, PreferenceRow } from "@/lib/types";

export const maxDuration = 60;

const prefsSchema = z.object({
  moods: z.array(z.string()),
  moodText: z.string(),
  languages: z.array(z.string()),
  contentType: z.enum(["movies", "include_series"]),
  minRating: z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]),
  eras: z.array(z.string()),
});

const bodySchema = z.object({
  deviceId: z.string().uuid(),
  preferences: prefsSchema,
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
  const { data: session, error: sessionError } = await supabase.from("sessions").select("*").eq("id", id).single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let partner: "a" | "b";
  if (session.device_a_id === parsed.data.deviceId) partner = "a";
  else if (session.device_b_id === parsed.data.deviceId) partner = "b";
  else return NextResponse.json({ error: "This device is not part of the session." }, { status: 403 });

  const p = parsed.data.preferences;
  const { error: upsertError } = await supabase.from("preferences").upsert(
    {
      session_id: id,
      partner,
      moods: p.moods,
      mood_text: p.moodText,
      languages: p.languages,
      content_type: p.contentType,
      min_rating: p.minRating,
      eras: p.eras,
    },
    { onConflict: "session_id,partner" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data: allPrefs } = await supabase.from("preferences").select("*").eq("session_id", id);
  const prefsA = allPrefs?.find((r) => r.partner === "a") as PreferenceRow | undefined;
  const prefsB = allPrefs?.find((r) => r.partner === "b") as PreferenceRow | undefined;

  if (!prefsA || !prefsB || session.status !== "collecting_prefs") {
    return NextResponse.json({ status: session.status, bothSubmitted: Boolean(prefsA && prefsB) });
  }

  await supabase.from("sessions").update({ status: "generating_pool" }).eq("id", id);

  try {
    const inputA = rowToInput(prefsA);
    const inputB = rowToInput(prefsB);

    const pastTaste = session.pair_key
      ? await summarizeTaste(await getPairHistory(supabase, session.pair_key, id))
      : "";

    const brief = await buildBrief(inputA, inputB, pastTaste || undefined);
    const mediaTypes = reconcileMediaTypes(inputA.contentType, inputB.contentType);
    const titles = await buildPool({ brief, mediaTypes, excludeTmdbIds: [] });

    if (titles.length === 0) {
      await supabase.from("sessions").update({ status: "collecting_prefs" }).eq("id", id);
      return NextResponse.json({ error: "Couldn't find titles matching both partners' preferences. Try loosening the filters." }, { status: 422 });
    }

    await supabase.from("pool_titles").insert(titles.map((t) => ({ ...t, session_id: id, round: 1 })));
    await supabase.from("sessions").update({ status: "swiping" }).eq("id", id);

    return NextResponse.json({ status: "swiping", bothSubmitted: true });
  } catch (err) {
    await supabase.from("sessions").update({ status: "collecting_prefs" }).eq("id", id);
    const message = err instanceof Error ? err.message : "Failed to generate the title pool.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
