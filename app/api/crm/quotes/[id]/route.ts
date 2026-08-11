import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";

const QUOTE_ROLES = ["owner", "admin", "manager", "agent"] as const;
const APPROVER_ROLES = ["owner", "admin", "manager"] as const;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireOrgRole(QUOTE_ROLES);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const admin = auth.admin!;

  const [{ data: quote, error }, { data: events }] = await Promise.all([
    admin.from("quotes")
      .select("id,quote_number,customer_id,work_order_id,status,subtotal,tax,total,discount_amount,discount_pct,installation_included,installation_amount,delivery_included,delivery_amount,approval_required,approved_by,approved_at,accepted_by_customer,accepted_at,customer_name_snapshot,customer_phone_snapshot,customer_address_snapshot,warranty_note,notes,internal_notes,sent_at,sent_channel,customer_response,customer_responded_at,created_at,updated_at,expires_at,public_token,quote_items(id,product_id,description,quantity,unit_price,discount_pct,discount_amount,line_total)")
      .eq("organization_id", auth.organizationId!)
      .eq("id", id)
      .single(),
    admin.from("quote_events")
      .select("id,event_type,actor_type,actor_user_id,metadata,created_at")
      .eq("organization_id", auth.organizationId!)
      .eq("quote_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (error || !quote) return NextResponse.json({ ok: false, error: "Cotización no encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, quote, events: events ?? [] });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { action?: string; internal_notes?: string };
  const action = String(body.action ?? "").trim();

  const allowedRoles = action === "approve_discount" ? APPROVER_ROLES : QUOTE_ROLES;
  const auth = await requireOrgRole(allowedRoles);
  if (auth.error) return auth.error;
  const admin = auth.admin!;

  const { data: quote, error } = await admin.from("quotes")
    .select("id,status,approval_required,approved_at,expires_at,customer_response")
    .eq("organization_id", auth.organizationId!)
    .eq("id", id)
    .single();
  if (error || !quote) return NextResponse.json({ ok: false, error: "Cotización no encontrada." }, { status: 404 });

  const now = new Date().toISOString();
  let updates: Record<string, unknown> = { updated_at: now };
  let eventType = action;

  if (action === "approve_discount") {
    if (quote.status !== "pending_approval") {
      return NextResponse.json({ ok: false, error: "Esta cotización no está pendiente de aprobación." }, { status: 409 });
    }
    updates = { ...updates, status: "draft", approved_by: auth.user!.id, approved_at: now };
  } else if (action === "cancel") {
    if (["accepted", "rejected", "cancelled"].includes(String(quote.status))) {
      return NextResponse.json({ ok: false, error: "La cotización ya está cerrada." }, { status: 409 });
    }
    updates = { ...updates, status: "cancelled" };
  } else if (action === "update_internal_notes") {
    updates = { ...updates, internal_notes: String(body.internal_notes ?? "").trim().slice(0, 2000) || null };
    eventType = "internal_notes_updated";
  } else {
    return NextResponse.json({ ok: false, error: "Acción no permitida." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await admin.from("quotes")
    .update(updates)
    .eq("organization_id", auth.organizationId!)
    .eq("id", id)
    .select("id,quote_number,status,approval_required,approved_at,internal_notes,updated_at")
    .single();

  if (updateError || !updated) return NextResponse.json({ ok: false, error: updateError?.message || "No fue posible actualizar la cotización." }, { status: 500 });

  await admin.from("quote_events").insert({
    organization_id: auth.organizationId,
    quote_id: id,
    event_type: eventType,
    actor_type: "user",
    actor_user_id: auth.user!.id,
    metadata: action === "update_internal_notes" ? { has_notes: Boolean(updates.internal_notes) } : {},
  });

  return NextResponse.json({ ok: true, quote: updated });
}
