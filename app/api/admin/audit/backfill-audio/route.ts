import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

export async function POST() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();
  if (!membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Solo un owner o admin puede ejecutar esto." }, { status: 403 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "Falta ELEVENLABS_API_KEY" }, { status: 503 });

  const { data: missing, error } = await admin
    .from("call_events")
    .select("id,conversation_id")
    .eq("event_type", "post_call_transcription")
    .is("audio_storage_path", null)
    .not("conversation_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!missing || missing.length === 0) {
    return NextResponse.json({ ok: true, recovered: 0, failed: 0, remaining: 0, details: [] });
  }

  const details: { conversation_id: string; ok: boolean; reason?: string }[] = [];
  let recovered = 0;

  for (const row of missing) {
    if (!row.conversation_id) continue;
    try {
      const audioResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${row.conversation_id}/audio`,
        { headers: { "xi-api-key": apiKey } },
      );
      if (!audioResponse.ok) {
        details.push({ conversation_id: row.conversation_id, ok: false, reason: `HTTP ${audioResponse.status} — audio no disponible en ElevenLabs` });
        continue;
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      const path = `${row.conversation_id}.mp3`;
      const { error: uploadError } = await admin.storage
        .from("call-recordings")
        .upload(path, Buffer.from(audioBuffer), { contentType: "audio/mpeg", upsert: true });

      if (uploadError) {
        details.push({ conversation_id: row.conversation_id, ok: false, reason: uploadError.message });
        continue;
      }

      await admin
        .from("call_events")
        .update({ audio_storage_path: path, audio_captured_at: new Date().toISOString() })
        .eq("id", row.id);

      recovered += 1;
      details.push({ conversation_id: row.conversation_id, ok: true });
    } catch (err) {
      details.push({ conversation_id: row.conversation_id, ok: false, reason: err instanceof Error ? err.message : "Error desconocido" });
    }
  }

  const { count: remaining } = await admin
    .from("call_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "post_call_transcription")
    .is("audio_storage_path", null)
    .not("conversation_id", "is", null);

  return NextResponse.json({
    ok: true,
    recovered,
    failed: details.filter((detail) => !detail.ok).length,
    remaining: remaining ?? 0,
    details,
  });
}
