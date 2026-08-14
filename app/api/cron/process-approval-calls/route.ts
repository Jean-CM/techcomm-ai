import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Runs on a schedule (see vercel.json). Finds Celulares tickets sitting in
// "esperando_aprobacion" that haven't been called successfully yet, and places
// an outbound call presenting the out-of-warranty repair quote for approval.

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
  const agentId = process.env.ELEVENLABS_APPROVAL_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if (!apiKey || !agentId || !phoneNumberId) {
    return NextResponse.json({
      ok: false,
      error: "Falta ELEVENLABS_API_KEY, ELEVENLABS_APPROVAL_AGENT_ID o ELEVENLABS_PHONE_NUMBER_ID",
    }, { status: 503 });
  }

  const admin = getSupabaseAdmin();
  const { data: due, error } = await admin
    .from("work_orders")
    .select("id, organization_id, order_number, customer_id, brand, model, issue, quote_id")
    .eq("service_line", "celulares")
    .eq("status", "esperando_aprobacion")
    .is("approval_call_attempted_at", null)
    .limit(15);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  const results = [];
  for (const order of due) {
    const [{ data: customer }, { data: quote }] = await Promise.all([
      order.customer_id
        ? admin.from("customers").select("full_name,phone").eq("id", order.customer_id).eq("organization_id", order.organization_id).maybeSingle()
        : Promise.resolve({ data: null }),
      order.quote_id
        ? admin.from("quotes").select("total").eq("id", order.quote_id).eq("organization_id", order.organization_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const toNumber = customer?.phone ? normalizeE164DominicanPhone(customer.phone) : null;
    if (!toNumber) {
      results.push({ order_id: order.id, ok: false, reason: "invalid_phone" });
      continue;
    }

    try {
      const callResponse = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: phoneNumberId,
          to_number: toNumber,
          call_recording_enabled: true,
          conversation_initiation_client_data: {
            dynamic_variables: {
              work_order_id: order.id,
              customer_name: customer?.full_name ?? "cliente",
              order_number: order.order_number,
              brand: order.brand ?? "",
              model: order.model ?? "",
              issue: order.issue ?? "",
              quote_total: quote?.total != null
                ? `RD$${Number(quote.total).toLocaleString("es-DO")}`
                : "el monto indicado en su cotización",
            },
          },
        }),
      });

      const payload = await callResponse.json().catch(() => null) as {
        conversation_id?: string;
        detail?: string;
        error?: string;
      } | null;

      if (!callResponse.ok) {
        results.push({
          order_id: order.id,
          ok: false,
          reason: payload?.detail ?? payload?.error ?? `elevenlabs_http_${callResponse.status}`,
        });
        continue;
      }

      const attemptedAt = new Date().toISOString();
      const { error: markError } = await admin
        .from("work_orders")
        .update({ approval_call_attempted_at: attemptedAt })
        .eq("id", order.id)
        .eq("organization_id", order.organization_id);

      if (markError) {
        results.push({ order_id: order.id, ok: false, reason: `call_started_but_mark_failed:${markError.message}` });
        continue;
      }

      await admin.from("approval_calls").insert({
        organization_id: order.organization_id,
        work_order_id: order.id,
        agent_name: "Agente IA",
        call_date: attemptedAt,
        status_cc: "pendiente",
        channel: "llamada",
      });

      results.push({
        order_id: order.id,
        ok: true,
        conversation_id: payload?.conversation_id,
      });
    } catch (err) {
      results.push({
        order_id: order.id,
        ok: false,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
