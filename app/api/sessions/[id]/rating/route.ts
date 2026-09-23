import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";

const bodySchema = z.object({
  tmdbId: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  stars: z.number().int().min(1).max(5),
  note: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.from("ratings").insert({
    session_id: id,
    tmdb_id: parsed.data.tmdbId,
    media_type: parsed.data.mediaType,
    stars: parsed.data.stars,
    note: parsed.data.note ?? "",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("sessions").update({ status: "done" }).eq("id", id);

  return NextResponse.json({ ok: true });
}
