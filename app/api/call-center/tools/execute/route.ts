import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

function authorized(request: Request) {
  const configured = process.env.AGENT_TOOL_SECRET;
  const header = request.headers.get("authorization");
  return Boolean(configured && header === `Bearer ${configured}`);
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function terminalInteractionState(value: string) {
  return ["completed", "failed", "no_answer", "escalated"].includes(value);
}

export async function POST(request: Request) {
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);

  const started = Date.now();
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const tool = String(body.tool || "").trim();
  const correlationId = String(body.correlation_id || randomUUID());
  const idempotencyKey = body.idempotency_key ? String(body.idempotency_key) : null;
  const admin = getSupabaseAdmin();

  let auditId: string | null = null;
  try {
    if (!tool) throw new Error("tool is required");

    if (idempotencyKey) {
      const { data: prior } = await admin
        .from("cc_tool_audit")
        .select("id,response_payload,success")
        .eq("organization_id", ORG_ID)
        .eq("tool_name", tool)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (prior?.success && prior.response_payload) {
        return response({ ...(prior.response_payload as object), replayed: true });
      }
    }

    const { data: audit, error: auditError } = await admin
      .from("cc_tool_audit")
      .insert({ organization_id: ORG_ID, tool_name: tool, correlation_id: correlationId, idempotency_key: idempotencyKey, request_payload: body })
      .select("id")
      .single();
    if (auditError) throw new Error(auditError.message);
    auditId = audit.id;

    const result = await executeTool(admin, tool, body, correlationId);
    const payload = { ok: true, tool, correlation_id: correlationId, ...result };

    await admin.from("cc_tool_audit").update({ success: true, response_payload: payload, duration_ms: Date.now() - started }).eq("id", auditId);
    return response(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (auditId) {
      await admin.from("cc_tool_audit").update({ success: false, response_payload: { ok: false, error: message }, error_code: "tool_execution_error", duration_ms: Date.now() - started }).eq("id", auditId);
    }
    return response({ ok: false, tool, correlation_id: correlationId, error: message }, 400);
  }
}

async function event(admin: ReturnType<typeof getSupabaseAdmin>, input: {
  aggregate_type: string; aggregate_id?: string | null; event_type: string; from_state?: string | null; to_state?: string | null; correlation_id: string; payload?: Record<string, unknown>;
}) {
  const { error } = await admin.from("cc_events").insert({ organization_id: ORG_ID, actor_type: "agent", ...input, payload: input.payload || {} });
  if (error) throw new Error(error.message);
}

async function executeTool(admin: ReturnType<typeof getSupabaseAdmin>, tool: string, b: Record<string, any>, correlationId: string) {
  if (tool === "ingest_purchase") {
    if (!b.customer?.full_name || !b.customer?.phone || !b.purchase?.product_name) throw new Error("customer.full_name, customer.phone and purchase.product_name are required");

    let distributorId: string | null = null;
    if (b.distributor?.name) {
      const { data: distributor, error } = await admin.from("cc_distributors").upsert({ organization_id: ORG_ID, name: String(b.distributor.name).trim(), external_id: b.distributor.external_id || null }, { onConflict: "organization_id,name" }).select("id").single();
      if (error) throw new Error(error.message);
      distributorId = distributor.id;
    }

    let storeId: string | null = null;
    if (b.store?.name) {
      const { data: store, error } = await admin.from("cc_stores").insert({ organization_id: ORG_ID, distributor_id: distributorId, name: String(b.store.name).trim(), external_id: b.store.external_id || null, province: b.store.province || null, municipality: b.store.municipality || null }).select("id").single();
      if (error) throw new Error(error.message);
      storeId = store.id;
    }

    let customer;
    const { data: existing } = await admin.from("cc_customers").select("*").eq("organization_id", ORG_ID).eq("phone", String(b.customer.phone).trim()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) customer = existing;
    else {
      const { data, error } = await admin.from("cc_customers").insert({ organization_id: ORG_ID, full_name: String(b.customer.full_name).trim(), phone: String(b.customer.phone).trim(), email: b.customer.email || null, external_id: b.customer.external_id || null }).select("*").single();
      if (error) throw new Error(error.message);
      customer = data;
    }

    const { data: purchase, error: purchaseError } = await admin.from("cc_purchases").insert({
      organization_id: ORG_ID, distributor_id: distributorId, store_id: storeId, customer_id: customer.id,
      external_id: b.purchase.external_id || null, invoice_number: b.purchase.invoice_number || null,
      product_name: String(b.purchase.product_name).trim(), brand: b.purchase.brand || null, model: b.purchase.model || null,
      serial_number: b.purchase.serial_number || null, installation_included: Boolean(b.purchase.installation_included),
      purchased_at: b.purchase.purchased_at || null, state: "contact_pending", metadata: b.purchase.metadata || {}
    }).select("*").single();
    if (purchaseError) throw new Error(purchaseError.message);

    await event(admin, { aggregate_type: "purchase", aggregate_id: purchase.id, event_type: "purchase.received", to_state: "received", correlation_id: correlationId });
    await event(admin, { aggregate_type: "purchase", aggregate_id: purchase.id, event_type: "purchase.validated", from_state: "received", to_state: "validated", correlation_id: correlationId });
    await event(admin, { aggregate_type: "purchase", aggregate_id: purchase.id, event_type: "purchase.contact_pending", from_state: "validated", to_state: "contact_pending", correlation_id: correlationId });
    return { customer, purchase, next_action: "contact_customer" };
  }

  if (tool === "get_purchase") {
    let query = admin.from("cc_purchases").select("*").eq("organization_id", ORG_ID);
    if (b.purchase_id) query = query.eq("id", b.purchase_id);
    else if (b.external_id) query = query.eq("external_id", b.external_id);
    else throw new Error("purchase_id or external_id is required");
    const { data: purchase, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!purchase) throw new Error("purchase not found");
    const [{ data: customer }, { data: installation }] = await Promise.all([
      admin.from("cc_customers").select("*").eq("id", purchase.customer_id).single(),
      admin.from("cc_installation_requests").select("*").eq("purchase_id", purchase.id).maybeSingle(),
    ]);
    let appointment = null;
    if (installation) {
      const { data } = await admin.from("cc_appointments").select("*").eq("installation_request_id", installation.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      appointment = data;
    }
    return { purchase, customer, installation_request: installation, appointment };
  }

  if (tool === "create_installation_request") {
    if (!b.purchase_id) throw new Error("purchase_id is required");
    const acceptance = String(b.acceptance_status || "pending");
    if (!["accepted", "declined", "pending"].includes(acceptance)) throw new Error("invalid acceptance_status");
    const { data: purchase, error } = await admin.from("cc_purchases").select("*").eq("id", b.purchase_id).eq("organization_id", ORG_ID).single();
    if (error) throw new Error(error.message);
    const { data: customer } = await admin.from("cc_customers").select("*").eq("id", purchase.customer_id).single();
    const completeLocation = Boolean(customer?.address && customer?.reference_1);
    const state = acceptance === "declined" ? "declined" : acceptance === "accepted" ? (completeLocation ? "scheduling" : "location_pending") : "contact_pending";
    const { data: installation, error: createError } = await admin.from("cc_installation_requests").upsert({ organization_id: ORG_ID, purchase_id: purchase.id, customer_id: purchase.customer_id, state, acceptance_status: acceptance, notes: b.notes || null, updated_at: new Date().toISOString() }, { onConflict: "purchase_id" }).select("*").single();
    if (createError) throw new Error(createError.message);
    const purchaseState = acceptance === "accepted" ? "converted" : acceptance === "declined" ? "contacted" : "contacted";
    await admin.from("cc_purchases").update({ state: purchaseState, updated_at: new Date().toISOString() }).eq("id", purchase.id);
    await event(admin, { aggregate_type: "installation_request", aggregate_id: installation.id, event_type: "installation_request.created", to_state: state, correlation_id: correlationId, payload: { acceptance_status: acceptance } });
    if (acceptance === "accepted") await event(admin, { aggregate_type: "installation_request", aggregate_id: installation.id, event_type: "installation_request.accepted", from_state: "contact_pending", to_state: state, correlation_id: correlationId });
    if (acceptance === "declined") await event(admin, { aggregate_type: "installation_request", aggregate_id: installation.id, event_type: "installation_request.declined", from_state: "contact_pending", to_state: "declined", correlation_id: correlationId });
    return { installation_request: installation, next_action: state === "location_pending" ? "collect_location" : state === "scheduling" ? "get_available_slots" : "close_or_follow_up" };
  }

  if (tool === "update_customer_location") {
    if (!b.address || !b.reference_1) throw new Error("address and reference_1 are required; reference_2 is optional");
    let customerId = b.customer_id as string | undefined;
    let installation = null as any;
    if (b.installation_request_id) {
      const { data, error } = await admin.from("cc_installation_requests").select("*").eq("id", b.installation_request_id).eq("organization_id", ORG_ID).single();
      if (error) throw new Error(error.message);
      installation = data;
      customerId = data.customer_id;
    }
    if (!customerId) throw new Error("customer_id or installation_request_id is required");
    const { data: customer, error } = await admin.from("cc_customers").update({ address: b.address, province: b.province || null, municipality: b.municipality || null, sector: b.sector || null, reference_1: b.reference_1, reference_2: b.reference_2 || null, latitude: b.latitude ?? null, longitude: b.longitude ?? null, updated_at: new Date().toISOString() }).eq("id", customerId).eq("organization_id", ORG_ID).select("*").single();
    if (error) throw new Error(error.message);
    await event(admin, { aggregate_type: "customer", aggregate_id: customer.id, event_type: "customer.location_updated", correlation_id: correlationId, payload: { has_reference_2: Boolean(b.reference_2) } });
    if (installation && installation.acceptance_status === "accepted") {
      await admin.from("cc_installation_requests").update({ state: "scheduling", updated_at: new Date().toISOString() }).eq("id", installation.id);
      await event(admin, { aggregate_type: "installation_request", aggregate_id: installation.id, event_type: "installation_request.ready_for_scheduling", from_state: installation.state, to_state: "scheduling", correlation_id: correlationId });
    }
    return { customer, next_action: installation ? "get_available_slots" : "none" };
  }

  if (tool === "get_available_slots") {
    if (!b.installation_request_id) throw new Error("installation_request_id is required");
    const { data: installation, error } = await admin.from("cc_installation_requests").select("*,cc_customers(address,reference_1)").eq("id", b.installation_request_id).eq("organization_id", ORG_ID).single();
    if (error) throw new Error(error.message);
    if (installation.acceptance_status !== "accepted") throw new Error("installation request is not accepted");
    const base = b.date_from ? new Date(`${b.date_from}T09:00:00-04:00`) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slots: { starts_at: string; ends_at: string; source: string }[] = [];
    for (let i = 0; slots.length < 6 && i < 10; i++) {
      const day = new Date(base.getTime() + i * 86400000);
      const weekday = day.getUTCDay();
      if (weekday === 0) continue;
      for (const hour of [9, 13]) {
        const ymd = day.toISOString().slice(0, 10);
        const starts = new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00-04:00`);
        const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
        const { count } = await admin.from("cc_appointments").select("*", { count: "exact", head: true }).eq("organization_id", ORG_ID).eq("starts_at", starts.toISOString()).in("state", ["confirmed", "rescheduled", "en_route", "arrived"]);
        if ((count || 0) === 0) slots.push({ starts_at: starts.toISOString(), ends_at: ends.toISOString(), source: "sandbox" });
      }
    }
    return { slots, source: "sandbox", warning: "Availability is simulated until Techcomm scheduling integration is connected." };
  }

  if (tool === "schedule_installation") {
    if (!b.installation_request_id || !b.starts_at) throw new Error("installation_request_id and starts_at are required");
    const { data: installation, error } = await admin.from("cc_installation_requests").select("*").eq("id", b.installation_request_id).eq("organization_id", ORG_ID).single();
    if (error) throw new Error(error.message);
    if (installation.acceptance_status !== "accepted" || !["scheduling", "scheduled"].includes(installation.state)) throw new Error("installation request is not ready for scheduling");
    const { data: customer } = await admin.from("cc_customers").select("address,reference_1").eq("id", installation.customer_id).single();
    if (!customer?.address || !customer?.reference_1) throw new Error("customer address and at least one reference are required before scheduling");
    const starts = new Date(b.starts_at);
    if (Number.isNaN(starts.getTime())) throw new Error("starts_at must be a valid ISO-8601 datetime");
    const ends = b.ends_at ? new Date(b.ends_at) : new Date(starts.getTime() + 2 * 60 * 60 * 1000);
    const { data: appointment, error: appointmentError } = await admin.from("cc_appointments").insert({ organization_id: ORG_ID, installation_request_id: installation.id, technician_id: b.technician_id || null, starts_at: starts.toISOString(), ends_at: ends.toISOString(), state: "confirmed", source: "ai", notes: b.notes || null }).select("*").single();
    if (appointmentError) throw new Error(appointmentError.message);
    await admin.from("cc_installation_requests").update({ state: "scheduled", updated_at: new Date().toISOString() }).eq("id", installation.id);
    await event(admin, { aggregate_type: "appointment", aggregate_id: appointment.id, event_type: "appointment.confirmed", to_state: "confirmed", correlation_id: correlationId, payload: { starts_at: appointment.starts_at } });
    await event(admin, { aggregate_type: "installation_request", aggregate_id: installation.id, event_type: "installation_request.scheduled", from_state: installation.state, to_state: "scheduled", correlation_id: correlationId });
    return { appointment, installation_request: { ...installation, state: "scheduled" }, next_action: "confirm_with_customer" };
  }

  if (tool === "register_interaction") {
    const state = String(b.state || "initiated");
    if (!["initiated", "connected", "completed", "failed", "no_answer", "escalated"].includes(state)) throw new Error("invalid interaction state");
    if (!b.channel) throw new Error("channel is required");
    const { data: interaction, error } = await admin.from("cc_interactions").insert({ organization_id: ORG_ID, installation_request_id: b.installation_request_id || null, customer_id: b.customer_id || null, channel: b.channel, direction: b.direction || "outbound", state, conversation_id: b.conversation_id || null, provider_call_id: b.provider_call_id || null, intent: b.intent || null, outcome: b.outcome || null, summary: b.summary || null, transcript: b.transcript || null, started_at: b.started_at || new Date().toISOString(), ended_at: terminalInteractionState(state) ? (b.ended_at || new Date().toISOString()) : null, metadata: b.metadata || {} }).select("*").single();
    if (error) throw new Error(error.message);
    await event(admin, { aggregate_type: "interaction", aggregate_id: interaction.id, event_type: `interaction.${state}`, to_state: state, correlation_id: correlationId, payload: { channel: b.channel, outcome: b.outcome || null } });
    if (state === "completed" && b.installation_request_id) {
      const { data: installation } = await admin.from("cc_installation_requests").select("purchase_id").eq("id", b.installation_request_id).maybeSingle();
      if (installation?.purchase_id) await admin.from("cc_purchases").update({ state: "contacted", updated_at: new Date().toISOString() }).eq("id", installation.purchase_id).eq("state", "contact_pending");
    }
    return { interaction };
  }

  throw new Error(`unsupported tool: ${tool}`);
}
