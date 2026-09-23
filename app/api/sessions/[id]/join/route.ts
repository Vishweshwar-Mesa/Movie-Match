import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, makePairKey } from "@/lib/supabase";

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
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (session.device_a_id === parsed.data.deviceId) {
    // This device created the session — treat as Partner A rejoining, not a new join.
    return NextResponse.json({ session, role: "a" });
  }

  if (session.device_b_id && session.device_b_id !== parsed.data.deviceId) {
    return NextResponse.json({ error: "This session already has two partners." }, { status: 409 });
  }

  const pairKey = makePairKey(session.device_a_id, parsed.data.deviceId);

  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update({ device_b_id: parsed.data.deviceId, pair_key: pairKey })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ session: updated, role: "b" });
}
