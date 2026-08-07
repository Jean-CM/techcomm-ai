import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Runs on a schedule (see vercel.json). Finds appointment reminders that are
// due, calls the customer via ElevenLabs' outbound-call API ~45 minutes
// before the technician is scheduled to arrive, and records the result.
// This is the customer-experience feature: nobody should be caught off
// guard by a technician showing up unannounced.

function normalizeE164DominicanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^(809|829|849)\d{7}$/.test(local)) return null;
  return `+1${local}`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_REMINDER_AGENT_ID || process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if (!apiKey || !agentId || !phoneNumberId) {
    return NextResponse.json({ ok: false, error: "Falta ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID o ELEVENLABS_PHONE_NUMBER_ID" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  const { data: due, error } = await supabase
    .from("call_reminders")
    .select("id, appointment_id, customer_phone, customer_name, appointment_starts_at, attempts")
    .eq("status", "pending")
    .eq("call_type", "appointment_reminder")
    .lte("scheduled_for", new Date().toISOString())
    .lt("attempts", 3)
    .limit(20);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  const results = [];
  for (const reminder of due) {
    const toNumber = reminder.customer_phone ? normalizeE164DominicanPhone(reminder.customer_phone) : null;
    if (!toNumber) {
      await supabase.from("call_reminders").update({
        status: "failed",
        last_error: "Teléfono inválido o ausente",
        attempts: reminder.attempts + 1,
        processed_at: new Date().toISOString(),
      }).eq("id", reminder.id);
      results.push({ id: reminder.id, ok: false, reason: "invalid_phone" });
      continue;
    }

    const appointmentTime = reminder.appointment_starts_at
      ? new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", hour: "numeric", minute: "2-digit" }).format(new Date(reminder.appointment_starts_at))
      : "la hora acordada";

    try {
      const callResponse = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: phoneNumberId,
          to_number: toNumber,
          call_recording_enabled: false,
          conversation_initiation_client_data: {
            dynamic_variables: {
              customer_name: reminder.customer_name ?? "cliente",
              appointment_time: appointmentTime,
              reminder_window: "en aproximadamente 45 minutos",
            },
          },
        }),
      });

      const payload = await callResponse.json().catch(() => null) as { conversation_id?: string } | null;

      await supabase.from("call_reminders").update({
        status: callResponse.ok ? "completed" : "failed",
        external_conversation_id: payload?.conversation_id ?? null,
        last_error: callResponse.ok ? null : JSON.stringify(payload),
        attempts: reminder.attempts + 1,
        processed_at: new Date().toISOString(),
      }).eq("id", reminder.id);

      results.push({ id: reminder.id, ok: callResponse.ok });
    } catch (err) {
      await supabase.from("call_reminders").update({
        status: "failed",
        last_error: err instanceof Error ? err.message : "Unknown error",
        attempts: reminder.attempts + 1,
        processed_at: new Date().toISOString(),
      }).eq("id", reminder.id);
      results.push({ id: reminder.id, ok: false });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
