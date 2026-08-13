import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = { work_order_id?: string; quote_id?: string; approved?: boolean };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Payload;
  if (!body.work_order_id) return NextResponse.json({ ok: false, error: "La orden es requerida." }, { status: 400 });

  const approved = body.approved !== false;
  const auth = await requireOrgRole(["owner","admin","manager"]);
  if ("error" in auth) return auth.error;
  const supabase = auth.admin!;
  const { data, error } = await supabase.from("work_orders").update({
    customer_repair_approved: approved,
    customer_repair_approved_at: approved ? new Date().toISOString() : null,
    quote_id: body.quote_id || null,
    status: approved ? "approved" : "pending_customer",
    updated_at: new Date().toISOString(),
  }).eq("id", body.work_order_id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, work_order: data });
}
