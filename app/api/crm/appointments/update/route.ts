import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

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
const DEFAULT_APPOINTMENT_MINUTES = 60;

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
    .select("id,customer_id,technician_id,starts_at,ends_at,status,address,notes")
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

  const targetTechnicianId = body.technician_id !== undefined ? body.technician_id : current.technician_id;
  const targetStartsAt = new Date(String(changes.starts_at ?? current.starts_at));
  const targetEndsAt = current.ends_at
    ? new Date(current.ends_at)
    : new Date(targetStartsAt.getTime() + DEFAULT_APPOINTMENT_MINUTES * 60 * 1000);

  let scheduleConflict: { id: string; starts_at: string; ends_at?: string | null; customer_id?: string | null } | null = null;

  if (targetTechnicianId && !Number.isNaN(targetStartsAt.getTime())) {
    const conflictWindowStart = new Date(targetStartsAt.getTime() - DEFAULT_APPOINTMENT_MINUTES * 60 * 1000).toISOString();
    const conflictWindowEnd = targetEndsAt.toISOString();

    const { data: nearbyAppointments } = await supabase
      .from("appointments")
      .select("id,customer_id,starts_at,ends_at,status")
      .eq("technician_id", targetTechnicianId)
      .neq("id", body.id)
      .not("status", "in", "(completed,cancelled)")
      .gte("starts_at", conflictWindowStart)
      .lt("starts_at", conflictWindowEnd)
      .order("starts_at", { ascending: true })
      .limit(10);

    scheduleConflict = (nearbyAppointments ?? []).find((item) => {
      const otherStart = new Date(item.starts_at);
      const otherEnd = item.ends_at
        ? new Date(item.ends_at)
        : new Date(otherStart.getTime() + DEFAULT_APPOINTMENT_MINUTES * 60 * 1000);
      return otherStart < targetEndsAt && otherEnd > targetStartsAt;
    }) ?? null;
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
    if (body.technician_id) {
      const token = crypto.randomUUID().replace(/-/g, "");
      const { data: updatedOrder } = await supabase
        .from("work_orders")
        .update({ technician_id: body.technician_id, technician_access_token: token, updated_at: new Date().toISOString() })
        .eq("appointment_id", body.id)
        .select("order_number,equipment,issue")
        .maybeSingle();

      const { data: technician } = await supabase.from("technicians").select("phone").eq("id", body.technician_id).maybeSingle();
      if (technician?.phone && updatedOrder) {
        const digits = technician.phone.replace(/\D/g, "");
        const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
        const e164 = /^(809|829|849)\d{7}$/.test(local) ? `+1${local}` : null;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        if (e164 && appUrl) {
          await sendWhatsAppMessage(
            e164,
            `Nueva orden asignada: ${updatedOrder.order_number}\n${updatedOrder.equipment} — ${updatedOrder.issue}\n\nUsa este enlace para marcar tu progreso:\n${appUrl}/tecnico/${token}`
          );
        }
      }
    } else {
      await supabase
        .from("work_orders")
        .update({ technician_id: null, updated_at: new Date().toISOString() })
        .eq("appointment_id", body.id);
    }
  }

  const warnings = [
    outsideHours ? "Programada fuera del horario habitual (8:00 a. m.–4:00 p. m.) por anulación manual." : null,
    scheduleConflict ? "Advertencia: el técnico seleccionado ya tiene otra cita que se cruza con este horario. El cambio fue guardado, pero conviene revisar la agenda." : null,
  ].filter(Boolean);

  await supabase.from("crm_audit_log").insert({
    entity_type: "appointments",
    entity_id: body.id,
    action: "operational_update",
    actor_name: body.actor_name?.trim() || "Usuario CRM",
    actor_role: body.actor_role?.trim() || "unknown",
    before_data: current,
    after_data: appointment,
    metadata: {
      ...(outsideHours ? { manual_override_outside_hours: true } : {}),
      ...(scheduleConflict ? { schedule_conflict_warning: true, conflicting_appointment_id: scheduleConflict.id } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    appointment,
    warning: warnings.length ? warnings.join(" ") : null,
    schedule_conflict: scheduleConflict,
  });
}
