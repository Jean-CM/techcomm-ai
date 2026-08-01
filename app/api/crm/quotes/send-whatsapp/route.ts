import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function whatsappId(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { quote_id?: string };
  if (!body.quote_id) return NextResponse.json({ ok: false, error: "quote_id es requerido." }, { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const phoneNumberId = process.env.ELEVENLABS_WHATSAPP_PHONE_NUMBER_ID;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const templateName = process.env.CUSTOMER_QUOTE_TEMPLATE_NAME ?? "techcomm_cotizacion_cliente";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://techcomm-ai-one.vercel.app";
  if (!apiKey || !phoneNumberId || !agentId) return NextResponse.json({ ok: false, error: "Faltan variables de ElevenLabs para WhatsApp." }, { status: 500 });

  const supabase = getSupabaseAdmin();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id,quote_number,total,customer_name_snapshot,customer_phone_snapshot,public_token,expires_at")
    .eq("id", body.quote_id)
    .single();
  if (error || !quote?.customer_phone_snapshot) return NextResponse.json({ ok: false, error: error?.message || "La cotización no tiene teléfono." }, { status: 404 });

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
      conversation_initiation_client_data: { dynamic_variables: { quote_id: quote.id, quote_token: quote.public_token } },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ ok: false, error: "No fue posible enviar la cotización por WhatsApp.", details: result }, { status: 502 });

  await supabase.from("quotes").update({ sent_at: new Date().toISOString(), sent_channel: "whatsapp", status: "sent" }).eq("id", quote.id);
  return NextResponse.json({ ok: true, preview_url: previewUrl, conversation_id: (result as { conversation_id?: string }).conversation_id });
}
