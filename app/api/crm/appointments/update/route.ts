import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = {
  id?: string;
  starts_at?: string;
  technician_id?: string | null;
  status?: string;
  actor_name?: string;
  actor_role?: string;
};

const ALLOWED_STATUSES = new Set(["scheduled", "confirmed", "rescheduled", "completed", "cancelled"]);
const SERVICE_TIME_ZONE = "America/Santo_Domingo";
const OPEN_MINUTES = 8 * 60;
const CLOSE_MINUTES = 16 * 60;

function minutesInSantoDomingo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SERVICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Payload;
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "La cita es requerida." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase
    .from("appointments")
    .select("id,customer_id,technician_id,starts_at,status,address,notes")
    .eq("id", body.id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ ok: false, error: currentError?.message || "Cita no encontrada." }, { status: 404 });
  }

  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let outsideHours = false;

  if (body.starts_at) {
    const parsed = new Date(body.starts_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ ok: false, error: "La fecha y hora no son válidas." }, { status: 400 });
    }
    const minutes = minutesInSantoDomingo(parsed);
    outsideHours = minutes < OPEN_MINUTES || minutes > CLOSE_MINUTES;
    changes.starts_at = parsed.toISOString();
    changes.status = body.status || "rescheduled";
    changes.confirmation_status = "pending";
  }

  if (body.technician_id !== undefined) {
    changes.technician_id = body.technician_id || null;
    changes.requires_manual_assignment = !body.technician_id;
    changes.technician_confirmation_status = body.technician_id ? "confirmed" : "pending";
    changes.technician_confirmation_at = body.technician_id ? new Date().toISOString() : null;
  }

  if (body.status) {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ ok: false, error: "Estado de cita no permitido." }, { status: 400 });
    }
    changes.status = body.status;
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .update(changes)
    .eq("id", body.id)
    .select()
    .single();

  if (error || !appointment) {
    return NextResponse.json({ ok: false, error: error?.message || "No fue posible actualizar la cita." }, { status: 500 });
  }

  if (body.technician_id !== undefined) {
    await supabase
      .from("work_orders")
      .update({ technician_id: body.technician_id || null, updated_at: new Date().toISOString() })
      .eq("appointment_id", body.id);
  }

  await supabase.from("crm_audit_log").insert({
    entity_type: "appointments",
    entity_id: body.id,
    action: "operational_update",
    actor_name: body.actor_name?.trim() || "Usuario CRM",
    actor_role: body.actor_role?.trim() || "unknown",
    before_data: current,
    after_data: appointment,
    metadata: outsideHours ? { manual_override_outside_hours: true } : {},
  });

  return NextResponse.json({
    ok: true,
    appointment,
    warning: outsideHours ? "Programada fuera del horario habitual (8:00 a. m.–4:00 p. m.) por anulación manual." : null,
  });
}
