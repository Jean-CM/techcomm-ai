import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id,quote_number,status,total,subtotal,tax,discount_amount,discount_pct,installation_included,installation_amount,delivery_included,delivery_amount,customer_name_snapshot,customer_phone_snapshot,customer_address_snapshot,warranty_note,notes,expires_at,customer_response,created_at,quote_items(id,description,quantity,unit_price,discount_pct,discount_amount,line_total)")
    .eq("public_token", token)
    .single();
  if (error || !quote) return NextResponse.json({ ok: false, error: "Cotización no encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, quote });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({})) as { action?: "approve" | "review" | "reject" };
  if (!body.action || !["approve", "review", "reject"].includes(body.action)) return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
  const status = body.action === "approve" ? "accepted" : body.action === "reject" ? "rejected" : "review_requested";
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("quotes").update({
    status,
    customer_response: body.action,
    customer_responded_at: new Date().toISOString(),
    accepted_at: body.action === "approve" ? new Date().toISOString() : null,
  }).eq("public_token", token).select("id,quote_number,status,work_order_id").single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "No fue posible actualizar la cotización." }, { status: 500 });
  if (body.action === "approve" && data.work_order_id) {
    await supabase.from("work_orders").update({ customer_approved_repair: true, customer_approved_at: new Date().toISOString(), status: "approved" }).eq("id", data.work_order_id);
  }
  return NextResponse.json({ ok: true, quote: data });
}
