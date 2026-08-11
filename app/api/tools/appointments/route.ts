import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";
import { checkServiceHours, SERVICE_HOURS_LABEL } from "@/lib/service-hours";

export async function POST(request: Request) {
  if (!requireToolSecret(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { customer_id?: string; technician_id?: string; starts_at?: string; ends_at?: string; address?: string; notes?: string };
  if (!body.customer_id || !body.starts_at || !body.address) {
    return NextResponse.json({ ok: false, error: "customer_id, starts_at y address son requeridos" }, { status: 400 });
  }

  const startsAt = new Date(body.starts_at);
  if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ ok: false, error: "starts_at inválido" }, { status: 400 });
  if (!checkServiceHours(startsAt).allowed) {
    return NextResponse.json({ ok: false, error: `La cita está fuera del horario de servicio. ${SERVICE_HOURS_LABEL}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("appointments").insert({
    customer_id: body.customer_id,
    technician_id: body.technician_id ?? null,
    starts_at: startsAt.toISOString(),
    ends_at: body.ends_at ?? null,
    address: body.address,
    notes: body.notes ?? null,
    status: "scheduled",
    confirmation_status: "pending",
  }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const reminderAt = new Date(startsAt.getTime() - 60 * 60 * 1000).toISOString();
  await supabase.from("call_reminders").insert({ appointment_id: data.id, scheduled_for: reminderAt });
  return NextResponse.json({ ok: true, appointment: data, reminder_scheduled_for: reminderAt, service_hours: SERVICE_HOURS_LABEL });
}

export async function PATCH(request: Request) {
  if (!requireToolSecret(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { appointment_id?: string; action?: "confirm" | "cancel" | "reschedule"; starts_at?: string };
  if (!body.appointment_id || !body.action) return NextResponse.json({ ok: false, error: "appointment_id y action son requeridos" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const changes: Record<string, unknown> = {};
  if (body.action === "confirm") { changes.status = "confirmed"; changes.confirmation_status = "confirmed"; }
  if (body.action === "cancel") { changes.status = "cancelled"; changes.confirmation_status = "cancelled"; }
  if (body.action === "reschedule") {
    if (!body.starts_at) return NextResponse.json({ ok: false, error: "starts_at es requerido para reprogramar" }, { status: 400 });
    const startsAt = new Date(body.starts_at);
    if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ ok: false, error: "starts_at inválido" }, { status: 400 });
    if (!checkServiceHours(startsAt).allowed) {
      return NextResponse.json({ ok: false, error: `La nueva fecha está fuera del horario de servicio. ${SERVICE_HOURS_LABEL}` }, { status: 400 });
    }
    changes.status = "rescheduled";
    changes.confirmation_status = "pending";
    changes.starts_at = startsAt.toISOString();
  }

  const { data, error } = await supabase.from("appointments").update(changes).eq("id", body.appointment_id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, appointment: data, service_hours: SERVICE_HOURS_LABEL });
}
