import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = {
  id?: string;
  status?: string;
  technician_id?: string | null;
  priority?: string;
  actor_name?: string;
  actor_role?: string;
};

const ALLOWED_STATUSES = new Set([
  "new",
  "scheduled",
  "assigned",
  "in_progress",
  "pending_customer",
  "approved",
  "on_hold",
  "completed",
  "cancelled",
]);

const ALLOWED_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Payload;
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "La orden es requerida." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", body.id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ ok: false, error: currentError?.message || "Orden no encontrada." }, { status: 404 });
  }

  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status) {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ ok: false, error: "Estado de orden no permitido." }, { status: 400 });
    }
    values.status = body.status;
  }

  if (body.priority) {
    if (!ALLOWED_PRIORITIES.has(body.priority)) {
      return NextResponse.json({ ok: false, error: "Prioridad no permitida." }, { status: 400 });
    }
    values.priority = body.priority;
  }

  if (body.technician_id !== undefined) {
    values.technician_id = body.technician_id || null;
  }

  const { data: order, error } = await supabase
    .from("work_orders")
    .update(values)
    .eq("id", body.id)
    .select()
    .single();

  if (error || !order) {
    return NextResponse.json({ ok: false, error: error?.message || "No fue posible actualizar la orden." }, { status: 500 });
  }

  if (current.appointment_id && body.technician_id !== undefined) {
    await supabase.from("appointments").update({
      technician_id: body.technician_id || null,
      requires_manual_assignment: !body.technician_id,
      technician_confirmation_status: body.technician_id ? "confirmed" : "pending",
      technician_confirmation_at: body.technician_id ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", current.appointment_id);
  }

  // The appointment's own status was never syncing with the order's status -
  // marking an order "completed" left its appointment stuck showing
  // "Programada" everywhere (dashboard, agenda), which looked like the work
  // was still pending even though it was done.
  if (current.appointment_id && body.status && ["completed", "cancelled"].includes(body.status)) {
    await supabase.from("appointments").update({
      status: body.status,
      updated_at: new Date().toISOString(),
    }).eq("id", current.appointment_id);
  }

  await supabase.from("crm_audit_log").insert({
    entity_type: "work_orders",
    entity_id: body.id,
    action: "operational_update",
    actor_name: body.actor_name?.trim() || "Usuario CRM",
    actor_role: body.actor_role?.trim() || "unknown",
    before_data: current,
    after_data: order,
  });

  return NextResponse.json({ ok: true, order });
}
