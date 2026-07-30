import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type JsonObject = Record<string, unknown>;

type ElevenLabsWebhookEvent = {
  type?: string;
  event_timestamp?: number;
  data?: JsonObject;
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNestedString(object: JsonObject, key: string): string | undefined {
  const entry = asObject(object[key]);
  return asString(entry.value);
}

function verifySignature(rawBody: string, header: string | null, secret: string | undefined) {
  if (!secret) return true;
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
  const timestamp = parts.t;
  const provided = parts.v0 ?? parts.v1;
  if (!timestamp || !provided) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("elevenlabs-signature"), process.env.ELEVENLABS_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let event: ElevenLabsWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ElevenLabsWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const data = asObject(event.data);
  const supabase = getSupabaseAdmin();

  if (event.type === "call_initiation_failure") {
    await supabase.from("call_events").upsert({
      conversation_id: asString(data.conversation_id),
      event_type: event.type,
      status: "failed",
      summary: asString(data.failure_reason) ?? "unknown",
      payload: event,
    }, { onConflict: "conversation_id,event_type" });
    return NextResponse.json({ ok: true });
  }

  if (event.type === "post_call_transcription") {
    const analysis = asObject(data.analysis);
    const collected = asObject(analysis.data_collection_results);
    const clientData = asObject(data.conversation_initiation_client_data);
    const dynamicVariables = asObject(clientData.dynamic_variables);

    await supabase.from("call_events").upsert({
      conversation_id: asString(data.conversation_id),
      agent_id: asString(data.agent_id),
      event_type: event.type,
      status: asString(data.status) ?? asString(analysis.call_successful) ?? "done",
      customer_phone: readNestedString(collected, "customer_phone") ?? asString(dynamicVariables.customer_phone) ?? null,
      order_id: readNestedString(collected, "order_id") ?? asString(dynamicVariables.order_id) ?? null,
      summary: asString(analysis.transcript_summary) ?? readNestedString(collected, "conversation_outcome") ?? null,
      transcript: Array.isArray(data.transcript) ? data.transcript : [],
      analysis,
      metadata: asObject(data.metadata),
      payload: event,
    }, { onConflict: "conversation_id,event_type" });

    const appointmentId = asString(dynamicVariables.appointment_id);
    const appointmentStatus = readNestedString(collected, "appointment_status");
    if (appointmentId && appointmentStatus) {
      const mapped = appointmentStatus === "confirmada" ? { status: "confirmed", confirmation_status: "confirmed" }
        : appointmentStatus === "cancelada" ? { status: "cancelled", confirmation_status: "cancelled" }
        : appointmentStatus === "reprogramada" ? { status: "rescheduled", confirmation_status: "reschedule_requested" }
        : null;
      if (mapped) await supabase.from("appointments").update(mapped).eq("id", appointmentId);
    }
  }

  return NextResponse.json({ ok: true });
}
