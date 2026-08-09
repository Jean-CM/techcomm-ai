import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

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
    return NextResponse.json({ ok: false, error: "Solo un owner o admin puede acceder a auditoría." }, { status: 403 });
  }

  const { data: event } = await admin.from("call_events").select("audio_storage_path").eq("id", id).maybeSingle();
  if (!event?.audio_storage_path) {
    return NextResponse.json({ ok: false, error: "Esta llamada no tiene audio guardado." }, { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("call-recordings")
    .createSignedUrl(event.audio_storage_path, 3600);
  if (error || !signed) return NextResponse.json({ ok: false, error: error?.message || "No se pudo generar el enlace." }, { status: 500 });

  return NextResponse.json({ ok: true, audio_url: signed.signedUrl });
}
