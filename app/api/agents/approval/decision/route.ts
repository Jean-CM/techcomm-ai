import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function safeEqualSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected || !received.startsWith("Bearer ")) return false;
  try {
    return timingSafeEqual(Buffer.from(received.slice(7)), Buffer.from(expected));
  } catch {
    return false;
  }
}

const RESULTS = new Set(["aprobado", "rechazado", "pendiente"]);

export async function POST(request: Request) {
  if (!safeEqualSecret(request.headers.get("authorization"), process.env.AGENT_TOOL_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    work_order_id?: string;
    approval_result?: string;
    rejection_reason?: string;
    discount_requested?: boolean;
    requested_discount_amount?: number | null;
    customer_comments?: string;
    identity_confirmed?: boolean;
    quote_understood?: boolean;
    supervisor_required?: boolean;
    conversation_id?: string;
  };

  const result = String(body.approval_result ?? "").trim().toLowerCase();
  if (!body.work_order_id || !RESULTS.has(result)) {
    return NextResponse.json({ ok: false, error: "work_order_id and valid approval_result are required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: workOrder, error: orderError } = await admin
    .from("work_orders")
    .select("id,organization_id,status,service_line,quote_id")
    .eq("id", body.work_order_id)
    .maybeSingle();

  if (orderError) return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });
  if (!workOrder) return NextResponse.json({ ok: false, error: "Work order not found" }, { status: 404 });
  if (workOrder.service_line !== "celulares") {
    return NextResponse.json({ ok: false, error: "Work order is not in the celulares service line" }, { status: 409 });
  }

  const discountRequested = body.discount_requested === true;
  const supervisorRequired = body.supervisor_required === true || discountRequested;
  const effectiveResult = supervisorRequired && result === "aprobado" ? "pendiente" : result;

  const idempotencyKey = createHash("sha256")
    .update([
      workOrder.id,
      body.conversation_id ?? "",
      effectiveResult,
      body.rejection_reason ?? "",
      String(body.requested_discount_amount ?? ""),
    ].join("|"))
    .digest("hex");

  const { data: decision, error: decisionError } = await admin
    .from("approval_decisions")
    .upsert({
      organization_id: workOrder.organization_id,
      work_order_id: workOrder.id,
      conversation_id: body.conversation_id?.trim() || null,
      approval_result: effectiveResult,
      rejection_reason: effectiveResult === "rechazado" ? body.rejection_reason?.trim() || "otro" : null,
      discount_requested: discountRequested,
      requested_discount_amount: discountRequested && Number.isFinite(Number(body.requested_discount_amount))
        ? Number(body.requested_discount_amount)
        : null,
      customer_comments: body.customer_comments?.trim() || null,
      identity_confirmed: typeof body.identity_confirmed === "boolean" ? body.identity_confirmed : null,
      quote_understood: typeof body.quote_understood === "boolean" ? body.quote_understood : null,
      supervisor_required: supervisorRequired,
      source: "elevenlabs",
      idempotency_key: idempotencyKey,
    }, { onConflict: "idempotency_key" })
    .select("id,approval_result,supervisor_required,created_at")
    .single();

  if (decisionError) return NextResponse.json({ ok: false, error: decisionError.message }, { status: 500 });

  await admin.from("approval_calls").insert({
    organization_id: workOrder.organization_id,
    work_order_id: workOrder.id,
    agent_name: "Agente IA",
    call_date: new Date().toISOString(),
    status_cc: effectiveResult,
    channel: "llamada",
    rejection_reason: effectiveResult === "rechazado" ? body.rejection_reason?.trim() || "otro" : null,
  });

  if (effectiveResult === "aprobado") {
    await admin.from("work_orders").update({
      status: "approved",
      customer_repair_approved: true,
      customer_repair_approved_at: new Date().toISOString(),
    }).eq("id", workOrder.id);

    if (workOrder.quote_id) {
      await admin.from("quotes").update({
        status: "accepted",
        accepted_by_customer: true,
        accepted_at: new Date().toISOString(),
        customer_response: "approved_by_call",
        customer_responded_at: new Date().toISOString(),
      }).eq("id", workOrder.quote_id);
    }
  } else if (effectiveResult === "rechazado") {
    await admin.from("work_orders").update({ status: "devuelto_cliente" }).eq("id", workOrder.id);
    if (workOrder.quote_id) {
      await admin.from("quotes").update({
        status: "rejected",
        accepted_by_customer: false,
        customer_response: body.rejection_reason?.trim() || "rejected_by_call",
        customer_responded_at: new Date().toISOString(),
      }).eq("id", workOrder.quote_id);
    }
  }

  return NextResponse.json({
    ok: true,
    registered: true,
    decision_id: decision.id,
    approval_result: decision.approval_result,
    supervisor_required: decision.supervisor_required,
  });
}
