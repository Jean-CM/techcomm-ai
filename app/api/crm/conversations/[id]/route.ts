import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: event, error } = await supabase
    .from("call_events")
    .select("id,conversation_id,customer_phone,status,summary,transcript,analysis,metadata,payload,audio_storage_path,audio_captured_at,created_at")
    .eq("id", id)
    .single();

  if (error || !event) {
    return NextResponse.json({ ok: false, error: error?.message || "Conversación no encontrada." }, { status: 404 });
  }

  let audioUrl: string | null = null;
  if (event.audio_storage_path) {
    const { data: signed } = await supabase.storage
      .from("call-recordings")
      .createSignedUrl(event.audio_storage_path, 3600);
    audioUrl = signed?.signedUrl ?? null;
  }

  const { data: conversation } = event.conversation_id
    ? await supabase
        .from("conversations")
        .select("id,customer_id,channel,external_id,intent,status,summary,started_at,ended_at")
        .eq("external_id", event.conversation_id)
        .maybeSingle()
    : { data: null };

  const { data: messages } = conversation?.id
    ? await supabase
        .from("messages")
        .select("id,role,content,message_type,created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return NextResponse.json({
    ok: true,
    event,
    conversation,
    messages: messages ?? [],
    audio_url: audioUrl,
  });
}
