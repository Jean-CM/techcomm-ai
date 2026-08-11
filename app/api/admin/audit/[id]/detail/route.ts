import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

async function requireOwnerOrAdmin() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return { error: NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 }) };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role)) {
    return { error: NextResponse.json({ ok: false, error: "Solo un owner o admin puede acceder a auditoría." }, { status: 403 }) };
  }

  return { admin };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwnerOrAdmin();
  if (auth.error) return auth.error;
  const admin = auth.admin!;
  const { id } = await context.params;

  const { data: event, error } = await admin
    .from("call_events")
    .select("id,conversation_id,customer_phone,status,summary,order_id,transcript,analysis,metadata,audio_storage_path,audio_captured_at,created_at")
    .eq("id", id)
    .eq("event_type", "post_call_transcription")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!event) return NextResponse.json({ ok: false, error: "Llamada no encontrada." }, { status: 404 });

  const [{ data: customer }, { data: order }] = await Promise.all([
    event.customer_phone
      ? admin.from("customers").select("full_name,phone,email,address,sector").eq("phone", event.customer_phone).maybeSingle()
      : Promise.resolve({ data: null }),
    event.order_id
      ? admin.from("work_orders").select("id,order_number,equipment,brand,model,issue,status,priority").eq("id", event.order_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    ok: true,
    detail: {
      id: event.id,
      conversation_id: event.conversation_id,
      status: event.status,
      summary: event.summary,
      transcript: Array.isArray(event.transcript) ? event.transcript : [],
      analysis: event.analysis ?? {},
      metadata: event.metadata ?? {},
      has_audio: Boolean(event.audio_storage_path),
      audio_captured_at: event.audio_captured_at,
      created_at: event.created_at,
      customer: customer ?? null,
      order: order ?? null,
    },
  });
}
