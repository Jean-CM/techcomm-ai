import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function normalizeE164DominicanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^(809|829|849)\d{7}$/.test(local)) return null;
  return `+1${local}`;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_APPROVAL_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if (!apiKey || !agentId || !phoneNumberId) {
    return NextResponse.json({ ok: false, error: "Approval call environment is incomplete" }, { status: 503 });
  }

  const admin = getSupabaseAdmin();
  const { data: followups, error } = await admin
    .from("approval_followups")
    .select("id,organization_id,work_order_id,scheduled_for,customer_comments,supervisor_required")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(15);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const results: Record<string, unknown>[] = [];

  for (const followup of followups ?? []) {
    const { data: order } = await admin
      .from("work_orders")
      .select("id,order_number,customer_id,brand,model,issue,quote_id,status,organization_id")
      .eq("id", followup.work_order_id)
      .eq("organization_id", followup.organization_id)
      .maybeSingle();

    if (!order || !["esperando_aprobacion", "pending"].includes(String(order.status))) {
      await admin.from("approval_followups").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", followup.id);
      results.push({ follow_up_id: followup.id, ok: false, reason: "order_not_pending" });
      continue;
    }

    const [{ data: customer }, { data: quote }] = await Promise.all([
      order.customer_id ? admin.from("customers").select("full_name,phone").eq("id", order.customer_id).eq("organization_id", followup.organization_id).maybeSingle() : Promise.resolve({ data: null }),
      order.quote_id ? admin.from("quotes").select("total").eq("id", order.quote_id).eq("organization_id", followup.organization_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const toNumber = customer?.phone ? normalizeE164DominicanPhone(customer.phone) : null;
    if (!toNumber) {
      await admin.from("approval_followups").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", followup.id);
      results.push({ follow_up_id: followup.id, ok: false, reason: "invalid_phone" });
      continue;
    }

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
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
              follow_up_id: followup.id,
              customer_name: customer?.full_name ?? "cliente",
              order_number: order.order_number,
              brand: order.brand ?? "",
              model: order.model ?? "",
              issue: order.issue ?? "",
              quote_total: quote?.total != null ? `RD$${Number(quote.total).toLocaleString("es-DO")}` : "el monto indicado en su cotización",
              previous_follow_up_comments: followup.customer_comments ?? "",
              supervisor_required: followup.supervisor_required === true ? "true" : "false",
            },
          },
        }),
      });
      const payload = await response.json().catch(() => null) as { conversation_id?: string } | null;
      if (!response.ok) throw new Error("ElevenLabs rejected follow-up call");

      await admin.from("approval_followups").update({
        status: "processing",
        conversation_id: payload?.conversation_id ?? null,
        updated_at: new Date().toISOString(),
      }).eq("id", followup.id);

      results.push({ follow_up_id: followup.id, ok: true, conversation_id: payload?.conversation_id });
    } catch (err) {
      await admin.from("approval_followups").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", followup.id);
      results.push({ follow_up_id: followup.id, ok: false, reason: err instanceof Error ? err.message : "unknown" });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
