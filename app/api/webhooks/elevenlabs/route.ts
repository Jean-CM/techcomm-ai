import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Voice cost constants — update if your ElevenLabs plan or Twilio rates change.
const ELEVENLABS_COST_PER_MINUTE = 0.10; // Creator plan published rate
const TWILIO_COST_PER_MINUTE_LOCAL = 0.1155; // Dominican Republic, landline
const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

type JsonObject = Record<string, unknown>;
type ElevenLabsWebhookEvent = { type?: string; event_timestamp?: number; data?: JsonObject };

type TranscriptItem = {
  role?: unknown;
  message?: unknown;
  text?: unknown;
  content?: unknown;
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNestedString(object: JsonObject, key: string): string | undefined {
  const entry = asObject(object[key]);
  return asString(entry.value) ?? asString(object[key]);
}

function normalizePhone(value?: string) {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.length === 10 ? digits : undefined;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const found = asString(value);
    if (found) return found;
  }
  return undefined;
}

function mapChannel(...values: unknown[]): "whatsapp" | "phone" | "web" | "email" {
  const raw = values.map((value) => String(value ?? "").toLowerCase()).join(" ");
  if (raw.includes("whatsapp")) return "whatsapp";
  if (raw.includes("email")) return "email";
  if (raw.includes("web")) return "web";
  return "phone";
}

function mapMessageRole(value: unknown): "customer" | "assistant" | "human" | "system" {
  const role = String(value ?? "").toLowerCase();
  if (["user", "customer", "client"].includes(role)) return "customer";
  if (["human", "operator", "agent_human"].includes(role)) return "human";
  if (role === "system") return "system";
  return "assistant";
}

function transcriptContent(item: TranscriptItem) {
  return firstString(item.message, item.text, item.content);
}

function verifySignature(rawBody: string, header: string | null, secret: string | undefined) {
  if (!secret) return true;
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
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
    await supabase.from("call_events").upsert(
      {
        conversation_id: asString(data.conversation_id),
        event_type: event.type,
        status: "failed",
        summary: asString(data.failure_reason) ?? "unknown",
        payload: event,
      },
      { onConflict: "conversation_id,event_type" },
    );
    return NextResponse.json({ ok: true });
  }

  if (event.type === "post_call_transcription") {
    const analysis = asObject(data.analysis);
    const collected = asObject(analysis.data_collection_results);
    const clientData = asObject(data.conversation_initiation_client_data);
    const dynamicVariables = asObject(clientData.dynamic_variables);
    const metadata = asObject(data.metadata);
    const userId = asString(data.user_id);
    const conversationExternalId = asString(data.conversation_id);
    const transcript = Array.isArray(data.transcript) ? (data.transcript as TranscriptItem[]) : [];
    const channel = mapChannel(metadata.channel, metadata.source, data.channel, data.communication_channel);
    let conversationId: string | undefined;

    const customerPhone = normalizePhone(
      firstString(
        readNestedString(collected, "customer_phone"),
        dynamicVariables.customer_phone,
        dynamicVariables.phone,
        dynamicVariables.whatsapp_user_id,
        clientData.user_id,
        metadata.phone_number,
        metadata.customer_phone,
        userId,
      ),
    );

    const customerName = firstString(
      readNestedString(collected, "customer_name"),
      dynamicVariables.customer_name,
      dynamicVariables.name,
      metadata.customer_name,
    );

    let customerId: string | null = null;
    if (customerPhone) {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id,full_name")
        .eq("phone", customerPhone)
        .maybeSingle();

      if (existingCustomer) {
        const customerChanges: Record<string, unknown> = {
          source: channel,
          updated_at: new Date().toISOString(),
        };
        if (customerName) customerChanges.full_name = customerName;
        const { data: updatedCustomer } = await supabase
          .from("customers")
          .update(customerChanges)
          .eq("id", existingCustomer.id)
          .select("id")
          .single();
        customerId = updatedCustomer?.id ?? existingCustomer.id;
      } else {
        const { data: insertedCustomer } = await supabase
          .from("customers")
          .insert({
            phone: customerPhone,
            full_name: customerName ?? null,
            source: channel,
          })
          .select("id")
          .single();
        customerId = insertedCustomer?.id ?? null;
      }
    }

    const summary = asString(analysis.transcript_summary) ?? readNestedString(collected, "conversation_outcome") ?? null;
    const intent = readNestedString(collected, "intent") ?? readNestedString(collected, "conversation_outcome") ?? null;
    const callStatus = asString(data.status) ?? asString(analysis.call_successful) ?? "done";

    await supabase.from("call_events").upsert(
      {
        conversation_id: conversationExternalId,
        agent_id: asString(data.agent_id),
        event_type: event.type,
        status: callStatus,
        customer_phone: customerPhone ?? null,
        order_id: readNestedString(collected, "order_id") ?? asString(dynamicVariables.order_id) ?? null,
        summary,
        transcript,
        analysis,
        metadata: {
          ...metadata,
          channel,
          customer_name: customerName ?? null,
          detected_phone: customerPhone ?? null,
        },
        payload: event,
      },
      { onConflict: "conversation_id,event_type" },
    );

    if (conversationExternalId) {
      const { data: existingConversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("external_id", conversationExternalId)
        .limit(1)
        .maybeSingle();

      conversationId = existingConversation?.id as string | undefined;
      const startedAt = event.event_timestamp
        ? new Date(event.event_timestamp * 1000).toISOString()
        : new Date().toISOString();

      if (conversationId) {
        await supabase
          .from("conversations")
          .update({
            customer_id: customerId,
            channel,
            intent,
            status: "resolved",
            summary,
            ended_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
      } else {
        const { data: createdConversation } = await supabase
          .from("conversations")
          .insert({
            customer_id: customerId,
            channel,
            external_id: conversationExternalId,
            intent,
            status: "resolved",
            summary,
            started_at: startedAt,
            ended_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        conversationId = createdConversation?.id;
      }

      if (conversationId && transcript.length) {
        await supabase.from("messages").delete().eq("conversation_id", conversationId);
        const messages = transcript
          .map((item) => {
            const content = transcriptContent(item);
            if (!content) return null;
            return {
              conversation_id: conversationId,
              role: mapMessageRole(item.role),
              content,
              message_type: "text",
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        if (messages.length) {
          await supabase.from("messages").insert(messages);
        }
      }
    }

    const appointmentId = asString(dynamicVariables.appointment_id);
    const appointmentStatus = readNestedString(collected, "appointment_status");
    const callDurationForValidation = Number(
      metadata.call_duration_secs ?? metadata.duration_secs ?? data.call_duration_secs ?? 0
    );
    // A real confirmation requires an actual back-and-forth. Voicemail pickups
    // and rings-with-no-answer produce very short "calls" with little to no
    // customer speech — never treat these as a confirmation, no matter what
    // the agent's own classification says, since it may have nothing real to
    // classify from.
    const userTurns = transcript.filter((item) => item.role === "user").length;
    const looksUnreachable = callDurationForValidation > 0 && (callDurationForValidation < 12 || userTurns === 0);

    if (appointmentId) {
      const mapped = looksUnreachable
        ? { confirmation_status: "unreachable" }
        : appointmentStatus === "confirmada"
          ? { status: "confirmed", confirmation_status: "confirmed" }
          : appointmentStatus === "cancelada"
            ? { status: "cancelled", confirmation_status: "cancelled" }
            : appointmentStatus === "reprogramada"
              ? { status: "rescheduled", confirmation_status: "reschedule_requested" }
              : null;
      if (mapped) await supabase.from("appointments").update(mapped).eq("id", appointmentId);
    }

    // Log the real voice cost for this call so it shows up in ai_agent_runs
    // alongside the text-channel runs from the OpenAI orchestrator.
    const durationSeconds = Number(
      metadata.call_duration_secs ?? metadata.duration_secs ?? data.call_duration_secs ?? 0
    );
    if (durationSeconds > 0) {
      const durationMinutes = durationSeconds / 60;
      await supabase.from("ai_agent_runs").insert({
        organization_id: DEFAULT_ORG_ID,
        conversation_id: conversationId ?? null,
        channel: "voice",
        model: asString(data.agent_id) ?? "elevenlabs-conversational-ai",
        status: callStatus === "failed" ? "error" : "success",
        tts_cost_usd: Number((durationMinutes * ELEVENLABS_COST_PER_MINUTE).toFixed(6)),
        telephony_cost_usd: Number((durationMinutes * TWILIO_COST_PER_MINUTE_LOCAL).toFixed(6)),
        latency_ms: Math.round(durationSeconds * 1000)
      });
    }
  }

  return NextResponse.json({ ok: true });
}
