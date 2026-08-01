import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const allowed = new Set(["available", "busy", "unavailable"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { technician_id?: string; status?: string };
  if (!body.technician_id || !body.status || !allowed.has(body.status)) {
    return NextResponse.json({ ok: false, error: "Técnico o estado no válido." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("technicians")
    .update({ status: body.status })
    .eq("id", body.technician_id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, technician: data });
}
