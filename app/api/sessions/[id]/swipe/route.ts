import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";

const bodySchema = z.object({
  deviceId: z.string().uuid(),
  round: z.number().int().positive(),
  tmdbId: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  direction: z.enum(["right", "left"]),
});

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

  const { error } = await supabase.from("swipes").upsert(
    {
      session_id: id,
      round: parsed.data.round,
      partner,
      tmdb_id: parsed.data.tmdbId,
      media_type: parsed.data.mediaType,
      direction: parsed.data.direction,
    },
    { onConflict: "session_id,round,partner,tmdb_id,media_type" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
