import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

  const event = JSON.parse(rawBody) as { type?: string; event_timestamp?: number; data?: Record<string, any> };
  const data = event.data ?? {};
  const supabase = getSupabaseAdmin();

  if (event.type === "call_initiation_failure") {
    await supabase.from("call_events").upsert({
      conversation_id: data.conversation_id,
      event_type: event.type,
      status: "failed",
      summary: data.failure_reason ?? "unknown",
      payload: event,
    }, { onConflict: "conversation_id,event_type" });
    return NextResponse.json({ ok: true });
  }

  if (event.type === "post_call_transcription") {
    const analysis = data.analysis ?? {};
    const collected = analysis.data_collection_results ?? {};
    const dynamicVariables = data.conversation_initiation_client_data?.dynamic_variables ?? {};
    await supabase.from("call_events").upsert({
      conversation_id: data.conversation_id,
      agent_id: data.agent_id,
      event_type: event.type,
      status: data.status ?? analysis.call_successful ?? "done",
      customer_phone: collected.customer_phone?.value ?? dynamicVariables.customer_phone ?? null,
      order_id: collected.order_id?.value ?? dynamicVariables.order_id ?? null,
      summary: analysis.transcript_summary ?? collected.conversation_outcome?.value ?? null,
      transcript: data.transcript ?? [],
      analysis,
      metadata: data.metadata ?? {},
      payload: event,
    }, { onConflict: "conversation_id,event_type" });

    const appointmentId = dynamicVariables.appointment_id;
    const appointmentStatus = collected.appointment_status?.value;
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
