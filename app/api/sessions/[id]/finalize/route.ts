import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import type { PoolTitleRow, SwipeRow } from "@/lib/types";

const bodySchema = z.object({
  deviceId: z.string().uuid(),
});

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

  if (session.status !== "swiping" || session.round !== 2) {
    return NextResponse.json({ session });
  }

  const { data: claimed } = await supabase
    .from("sessions")
    .update({ status: "generating_pool" })
    .eq("id", id)
    .eq("status", "swiping")
    .eq("round", 2)
    .select()
    .maybeSingle();

  if (!claimed) {
    const { data: current } = await supabase.from("sessions").select("*").eq("id", id).single();
    return NextResponse.json({ session: current });
  }

  const [{ data: pool }, { data: swipes }] = await Promise.all([
    supabase.from("pool_titles").select("*").eq("session_id", id).in("round", [1, 2]),
    supabase.from("swipes").select("*").eq("session_id", id).in("round", [1, 2]).eq("direction", "right"),
  ]);

  const titles = pool as PoolTitleRow[];
  const rightSwipes = swipes as SwipeRow[];

  const scoreByKey = new Map<string, number>();
  for (const s of rightSwipes) {
    const key = `${s.media_type}:${s.tmdb_id}`;
    scoreByKey.set(key, (scoreByKey.get(key) ?? 0) + 1);
  }

  const ranked = [...titles].sort((a, b) => {
    const scoreDiff = (scoreByKey.get(`${b.media_type}:${b.tmdb_id}`) ?? 0) - (scoreByKey.get(`${a.media_type}:${a.tmdb_id}`) ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.imdb_rating ?? 0) - (a.imdb_rating ?? 0);
  });

  const finalPicks = ranked.slice(0, 5).map((t) => ({ tmdb_id: t.tmdb_id, media_type: t.media_type }));

  const { data: updated } = await supabase
    .from("sessions")
    .update({ status: "final_pick", final_picks: finalPicks })
    .eq("id", id)
    .select()
    .single();

  return NextResponse.json({ session: updated });
}
