import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";

const QUOTE_WRITE_ROLES = ["owner", "admin", "manager", "agent"] as const;

function whatsappId(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
}

function nextChannel(current: string | null | undefined, next: string) {
  if (!current) return next;
  if (current === next || current === "multiple") return current;
  return "multiple";
}

export async function POST(request: Request) {
  const auth = await requireOrgRole(QUOTE_WRITE_ROLES);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({})) as { quote_id?: string };
  const quoteId = String(body.quote_id ?? "").trim();
  if (!quoteId) return NextResponse.json({ ok: false, error: "quote_id es requerido." }, { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const phoneNumberId = process.env.ELEVENLABS_WHATSAPP_PHONE_NUMBER_ID;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const templateName = process.env.CUSTOMER_QUOTE_TEMPLATE_NAME ?? "techcomm_cotizacion_cliente";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://techcomm-ai-one.vercel.app";
  if (!apiKey || !phoneNumberId || !agentId) {
    return NextResponse.json({ ok: false, error: "La integración de WhatsApp no está configurada." }, { status: 503 });
  }

  const admin = auth.admin!;
  const { data: quote, error } = await admin
    .from("quotes")
    .select("id,quote_number,status,total,approval_required,approved_at,customer_name_snapshot,customer_phone_snapshot,public_token,expires_at,sent_channel")
    .eq("organization_id", auth.organizationId!)
    .eq("id", quoteId)
    .single();

  if (error || !quote) return NextResponse.json({ ok: false, error: "Cotización no encontrada." }, { status: 404 });
  if (!quote.customer_phone_snapshot) return NextResponse.json({ ok: false, error: "La cotización no tiene teléfono de cliente." }, { status: 409 });
  if (quote.status === "pending_approval" || (quote.approval_required && !quote.approved_at)) {
    return NextResponse.json({ ok: false, error: "La cotización requiere aprobación interna antes de enviarse." }, { status: 409 });
  }
  if (["accepted", "rejected", "cancelled", "expired"].includes(String(quote.status))) {
    return NextResponse.json({ ok: false, error: `No se puede enviar una cotización en estado ${quote.status}.` }, { status: 409 });
  }
  if (quote.expires_at && new Date(quote.expires_at).getTime() <= Date.now()) {
    await admin.from("quotes").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", quote.id).eq("organization_id", auth.organizationId!);
    return NextResponse.json({ ok: false, error: "La cotización está vencida. Crea una revisión antes de enviarla." }, { status: 409 });
  }

  const previewUrl = `${appUrl}/cotizacion/${quote.public_token}`;
  const parameters = [
    quote.customer_name_snapshot || "Cliente",
    quote.quote_number,
    `RD$${Number(quote.total || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`,
    quote.expires_at ? new Date(quote.expires_at).toLocaleDateString("es-DO") : "7 días",
    previewUrl,
  ];

  const response = await fetch("https://api.elevenlabs.io/v1/convai/whatsapp/outbound-message", {
    method: "POST",
    headers: { "content-type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_user_id: whatsappId(quote.customer_phone_snapshot),
      template_name: templateName,
      template_language_code: "es",
      template_params: [{ type: "body", parameters: parameters.map((text) => ({ text })) }],
      agent_id: agentId,
      conversation_initiation_client_data: {
        dynamic_variables: { quote_id: quote.id, quote_token: quote.public_token },
      },
    }),
  });

  const result = await response.json().catch(() => ({})) as { conversation_id?: string };
  if (!response.ok) {
    await admin.from("quote_events").insert({
      organization_id: auth.organizationId,
      quote_id: quote.id,
      event_type: "send_failed",
      actor_type: "user",
      actor_user_id: auth.user!.id,
      metadata: { channel: "whatsapp", provider_status: response.status },
    });
    return NextResponse.json({ ok: false, error: "No fue posible enviar la cotización por WhatsApp." }, { status: 502 });
  }

  const now = new Date().toISOString();
  const sentChannel = nextChannel(quote.sent_channel, "whatsapp");
  await admin.from("quotes")
    .update({ sent_at: now, sent_channel: sentChannel, status: "sent", updated_at: now })
    .eq("id", quote.id)
    .eq("organization_id", auth.organizationId!);
  await admin.from("quote_events").insert({
    organization_id: auth.organizationId,
    quote_id: quote.id,
    event_type: "sent",
    actor_type: "user",
    actor_user_id: auth.user!.id,
    metadata: { channel: "whatsapp", conversation_id: result.conversation_id ?? null },
  });

  return NextResponse.json({ ok: true, preview_url: previewUrl, conversation_id: result.conversation_id });
}
