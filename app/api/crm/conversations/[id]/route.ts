import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await requireOrgRole(["owner","admin","manager","agent"]);
  if ("error" in auth) return auth.error;
  const supabase = auth.admin!;

  // New CRM overview passes a conversation UUID. Keep a legacy fallback for
  // older links that still pass a call_event UUID.
  const { data: directConversation } = await supabase
    .from("conversations")
    .select("id,customer_id,channel,external_id,intent,status,summary,started_at,ended_at")
    .eq("id", id)
    .maybeSingle();

  let conversation = directConversation;
  let event: {
    id: string;
    conversation_id: string | null;
    customer_phone: string | null;
    status: string | null;
    summary: string | null;
    created_at: string;
    audio_storage_path?: string | null;
  } | null = null;

  if (conversation?.external_id) {
    const { data: matchedEvent } = await supabase
      .from("call_events")
      .select("id,conversation_id,customer_phone,status,summary,created_at,audio_storage_path")
      .eq("conversation_id", conversation.external_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    event = matchedEvent;
  }

  if (!conversation) {
    const { data: legacyEvent, error: legacyError } = await supabase
      .from("call_events")
      .select("id,conversation_id,customer_phone,status,summary,created_at,audio_storage_path")
      .eq("id", id)
      .maybeSingle();

    if (legacyError || !legacyEvent) {
      return NextResponse.json({ ok: false, error: legacyError?.message || "Conversación no encontrada." }, { status: 404 });
    }

    event = legacyEvent;
    if (legacyEvent.conversation_id) {
      const { data: matchedConversation } = await supabase
        .from("conversations")
        .select("id,customer_id,channel,external_id,intent,status,summary,started_at,ended_at")
        .eq("external_id", legacyEvent.conversation_id)
        .maybeSingle();
      conversation = matchedConversation;
    }
  }

  const { data: messages } = conversation?.id
    ? await supabase
        .from("messages")
        .select("id,role,content,message_type,created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  // Do not return a signed audio URL here. Regular CRM roles can inspect the
  // conversation text, while audio remains available only through the
  // owner/admin audit endpoints under /api/admin/audit.
  const safeEvent = event
    ? {
        id: event.id,
        conversation_id: event.conversation_id,
        customer_phone: event.customer_phone,
        status: event.status,
        summary: event.summary,
        created_at: event.created_at,
        audio_available: Boolean(event.audio_storage_path),
      }
    : null;

  return NextResponse.json({
    ok: true,
    event: safeEvent,
    conversation,
    messages: messages ?? [],
    audio_url: null,
  });
}
