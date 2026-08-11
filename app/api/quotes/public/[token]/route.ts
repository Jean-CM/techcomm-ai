import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_CUSTOMER_ACTIONS = new Set(["approve", "review", "reject"]);

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id,quote_number,status,total,subtotal,tax,discount_amount,discount_pct,installation_included,installation_amount,delivery_included,delivery_amount,customer_name_snapshot,customer_address_snapshot,warranty_note,notes,expires_at,customer_response,created_at,quote_items(id,description,quantity,unit_price,discount_pct,discount_amount,line_total)")
    .eq("public_token", token)
    .single();

  if (error || !quote) return NextResponse.json({ ok: false, error: "Cotización no encontrada." }, { status: 404 });

  const expired = Boolean(quote.expires_at && new Date(quote.expires_at).getTime() <= Date.now());
  return NextResponse.json({
    ok: true,
    quote: {
      ...quote,
      status: expired && !quote.customer_response && !["accepted", "rejected", "cancelled"].includes(String(quote.status)) ? "expired" : quote.status,
      can_respond: !expired && !quote.customer_response && quote.status === "sent",
    },
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({})) as { action?: "approve" | "review" | "reject" };
  const action = String(body.action ?? "");
  if (!ALLOWED_CUSTOMER_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id,quote_number,status,work_order_id,expires_at,customer_response,organization_id")
    .eq("public_token", token)
    .single();

  if (quoteError || !quote) return NextResponse.json({ ok: false, error: "Cotización no encontrada." }, { status: 404 });
  if (quote.customer_response) {
    return NextResponse.json({ ok: false, error: "Esta cotización ya recibió una respuesta." }, { status: 409 });
  }
  if (quote.status === "pending_approval") {
    return NextResponse.json({ ok: false, error: "La cotización aún está pendiente de aprobación interna." }, { status: 409 });
  }
  if (quote.status !== "sent") {
    return NextResponse.json({ ok: false, error: "La cotización no está disponible para respuesta." }, { status: 409 });
  }
  if (quote.expires_at && new Date(quote.expires_at).getTime() <= Date.now()) {
    await supabase.from("quotes").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", quote.id);
    return NextResponse.json({ ok: false, error: "La cotización está vencida." }, { status: 410 });
  }

  const status = action === "approve" ? "accepted" : action === "reject" ? "rejected" : "review_requested";
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("quotes").update({
    status,
    customer_response: action,
    customer_responded_at: now,
    accepted_at: action === "approve" ? now : null,
    accepted_by_customer: action === "approve",
    updated_at: now,
  })
    .eq("id", quote.id)
    .is("customer_response", null)
    .select("id,quote_number,status,work_order_id")
    .single();

  if (error || !data) return NextResponse.json({ ok: false, error: "No fue posible registrar la respuesta." }, { status: 409 });

  await supabase.from("quote_events").insert({
    organization_id: quote.organization_id,
    quote_id: quote.id,
    event_type: "customer_response",
    actor_type: "customer",
    actor_user_id: null,
    metadata: { action, resulting_status: status },
  });

  if (action === "approve" && data.work_order_id) {
    await supabase.from("work_orders").update({
      customer_repair_approved: true,
      customer_repair_approved_at: now,
      status: "approved",
      updated_at: now,
    }).eq("id", data.work_order_id);
  }

  return NextResponse.json({ ok: true, quote: data });
}
