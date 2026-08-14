import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function safeEqualSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const prefix = "Bearer ";
  if (!received.startsWith(prefix)) return false;
  const value = received.slice(prefix.length);
  try {
    return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parseScheduledFor(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function POST(request: Request) {
  if (!safeEqualSecret(request.headers.get("authorization"), process.env.AGENT_TOOL_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    work_order_id?: string;
    follow_up_date?: string;
    customer_comments?: string;
    supervisor_required?: boolean;
    conversation_id?: string;
  };

  if (!body.work_order_id) {
    return NextResponse.json({ ok: false, error: "work_order_id is required" }, { status: 400 });
  }

  const scheduledFor = parseScheduledFor(body.follow_up_date);
  if (!scheduledFor) {
    return NextResponse.json(
      { ok: false, error: "follow_up_date must be a valid ISO-8601 date/time" },
      { status: 400 },
    );
  }

  if (scheduledFor.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: "follow_up_date must be in the future" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: workOrder, error: workOrderError } = await admin
    .from("work_orders")
    .select("id,organization_id,status,service_line")
    .eq("id", body.work_order_id)
    .maybeSingle();

  if (workOrderError) {
    return NextResponse.json({ ok: false, error: workOrderError.message }, { status: 500 });
  }
  if (!workOrder) {
    return NextResponse.json({ ok: false, error: "Work order not found" }, { status: 404 });
  }
  if (workOrder.service_line !== "celulares") {
    return NextResponse.json({ ok: false, error: "Work order is not in the celulares service line" }, { status: 409 });
  }
  if (!["esperando_aprobacion", "pending"].includes(String(workOrder.status))) {
    return NextResponse.json({ ok: false, error: "Work order is not awaiting approval" }, { status: 409 });
  }

  const idempotencyKey = createHash("sha256")
    .update(`${workOrder.id}|${scheduledFor.toISOString()}|${body.conversation_id ?? ""}`)
    .digest("hex");

  const { data: followUp, error: followUpError } = await admin
    .from("approval_followups")
    .upsert(
      {
        organization_id: workOrder.organization_id,
        work_order_id: workOrder.id,
        scheduled_for: scheduledFor.toISOString(),
        customer_comments: body.customer_comments?.trim() || null,
        supervisor_required: body.supervisor_required === true,
        source: "elevenlabs",
        conversation_id: body.conversation_id?.trim() || null,
        idempotency_key: idempotencyKey,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "idempotency_key" },
    )
    .select("id,scheduled_for,status")
    .single();

  if (followUpError) {
    return NextResponse.json({ ok: false, error: followUpError.message }, { status: 500 });
  }

  await admin.from("approval_calls").insert({
    organization_id: workOrder.organization_id,
    work_order_id: workOrder.id,
    agent_name: "Agente IA",
    call_date: new Date().toISOString(),
    status_cc: "pendiente",
    channel: "llamada",
    rejection_reason: null,
  });

  return NextResponse.json({
    ok: true,
    registered: true,
    follow_up_id: followUp.id,
    scheduled_for: followUp.scheduled_for,
    status: followUp.status,
  });
}
