import { NextResponse } from "next/server";
import twilio from "twilio";

// Twilio sends WhatsApp webhooks as application/x-www-form-urlencoded.
// We take the inbound message, run it through our own orchestrator
// (the OpenAI brain, not ElevenLabs), and reply synchronously via TwiML.

function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !signature) return false; // fail-closed
  return twilio.validateRequest(authToken, signature, url, params);
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => { params[key] = String(value); });

  const signature = request.headers.get("x-twilio-signature");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const fullUrl = host ? `${proto}://${host}/api/webhooks/whatsapp` : request.url;

  if (!verifyTwilioSignature(fullUrl, params, signature)) {
    const token = process.env.TWILIO_AUTH_TOKEN ?? "";
    console.error("Twilio signature mismatch", {
      fullUrl,
      hasSignature: Boolean(signature),
      hasToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
      tokenLength: token.length,
      tokenPreview: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : null
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = String(form.get("Body") ?? "").trim();
  const from = String(form.get("From") ?? ""); // e.g. "whatsapp:+18095551234"
  const phone = from.replace("whatsapp:", "").replace(/^\+1/, "");

  if (!body) {
    return new NextResponse(twiml("No recibí ningún mensaje, ¿puedes intentar de nuevo?"), {
      headers: { "Content-Type": "text/xml" }
    });
  }

  const secret = process.env.TECHCOMM_TOOL_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  try {
    const response = await fetch(`${appUrl}/api/agent/orchestrate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-techcomm-tool-secret": secret } : {})
      },
      body: JSON.stringify({
        message: body,
        channel: "whatsapp",
        customer_phone: phone
      })
    });

    const data = await response.json();
    const reply = data?.reply || "Disculpa, tuve un problema procesando tu mensaje. Un agente humano te va a contactar pronto.";

    return new NextResponse(twiml(reply), { headers: { "Content-Type": "text/xml" } });
  } catch {
    return new NextResponse(
      twiml("Disculpa, tuve un problema procesando tu mensaje. Un agente humano te va a contactar pronto."),
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
