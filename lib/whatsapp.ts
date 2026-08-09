// Sends a proactive (not reply-triggered) WhatsApp message via Twilio's REST API.
// Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (already used for webhook
// signature verification), and TWILIO_WHATSAPP_FROM (format: "+18095551234",
// no "whatsapp:" prefix — added here).

export async function sendWhatsAppMessage(toPhoneE164: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: "Faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_WHATSAPP_FROM" };
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const params = new URLSearchParams({
    To: `whatsapp:${toPhoneE164}`,
    From: `whatsapp:${fromNumber}`,
    Body: body,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, error: `Twilio HTTP ${response.status}: ${detail}` };
  }
  return { ok: true };
}
