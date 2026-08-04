import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const toolSecret = request.headers.get("x-techcomm-tool-secret");
  const cronSecret = process.env.CRON_SECRET;
  const configuredToolSecret = process.env.TECHCOMM_TOOL_SECRET;
  return Boolean(
    (cronSecret && bearer === cronSecret) ||
    (configuredToolSecret && toolSecret === configuredToolSecret),
  );
}

function toE164(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (/^(809|829|849)\d{7}$/.test(digits)) return `+1${digits}`;
  if (/^1(809|829|849)\d{7}$/.test(digits)) return `+${digits}`;
  return null;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if (!apiKey || !agentId || !phoneNumberId) {
    return NextResponse.json({
      ok: false,
      error: "Faltan ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID o ELEVENLABS_PHONE_NUMBER_ID.",
    }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: reminders, error } = await supabase
    .from("call_reminders")
    .select("id,appointment_id,scheduled_for,customer_phone,customer_name,appointment_starts_at,attempts,status")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(5);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const reminder of reminders ?? []) {
    const phone = toE164(reminder.customer_phone);
    if (!phone || !reminder.appointment_starts_at) {
      await supabase.from("call_reminders").update({
        status: "failed",
        attempts: Number(reminder.attempts || 0) + 1,
        last_error: "Teléfono o fecha de cita no válidos.",
        updated_at: new Date().toISOString(),
      }).eq("id", reminder.id);
      results.push({ id: reminder.id, success: false, error: "Datos incompletos" });
      continue;
    }

    const customerName = reminder.customer_name || "cliente";
    const appointmentText = dateLabel(reminder.appointment_starts_at);

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: phoneNumberId,
          to_number: phone,
          conversation_initiation_client_data: {
            dynamic_variables: {
              appointment_confirmation_mode: "true",
              customer_name: customerName,
              appointment_id: reminder.appointment_id,
              appointment_datetime: appointmentText,
            },
            conversation_config_override: {
              agent: {
                first_message: `Hola, ${customerName}. Te llamamos de Techcomm Wireless para confirmar tu visita programada para ${appointmentText}. ¿Podrás recibir al técnico en ese horario?`,
              },
            },
          },
        }),
      });

      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok || payload.success === false) {
        throw new Error(String(payload.message || payload.detail || `ElevenLabs respondió ${response.status}`));
      }

      await supabase.from("call_reminders").update({
        status: "sent",
        attempts: Number(reminder.attempts || 0) + 1,
        external_conversation_id: payload.conversation_id || null,
        result: JSON.stringify(payload),
        processed_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", reminder.id);

      results.push({ id: reminder.id, success: true, conversation_id: payload.conversation_id || null });
    } catch (callError) {
      const message = callError instanceof Error ? callError.message : "Error al iniciar la llamada";
      const attempts = Number(reminder.attempts || 0) + 1;
      await supabase.from("call_reminders").update({
        status: attempts >= 3 ? "failed" : "pending",
        attempts,
        last_error: message,
        updated_at: new Date().toISOString(),
      }).eq("id", reminder.id);
      results.push({ id: reminder.id, success: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
