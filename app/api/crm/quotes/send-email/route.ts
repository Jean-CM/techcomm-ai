import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";

const QUOTE_WRITE_ROLES = ["owner", "admin", "manager", "agent"] as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.QUOTE_EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://techcomm-ai-one.vercel.app";
  if (!apiKey || !from) {
    return NextResponse.json({
      ok: false,
      error: "El envío por correo aún no está configurado. Define RESEND_API_KEY y QUOTE_EMAIL_FROM.",
    }, { status: 503 });
  }

  const admin = auth.admin!;
  const { data: quote, error } = await admin
    .from("quotes")
    .select("id,quote_number,status,total,approval_required,approved_at,customer_name_snapshot,customer_email_snapshot,public_token,expires_at,sent_channel")
    .eq("organization_id", auth.organizationId!)
    .eq("id", quoteId)
    .single();

  if (error || !quote) return NextResponse.json({ ok: false, error: "Cotización no encontrada." }, { status: 404 });
  if (!quote.customer_email_snapshot) {
    return NextResponse.json({ ok: false, error: "La cotización no tiene correo del cliente." }, { status: 409 });
  }
  if (quote.status === "pending_approval" || (quote.approval_required && !quote.approved_at)) {
    return NextResponse.json({ ok: false, error: "La cotización requiere aprobación interna antes de enviarse." }, { status: 409 });
  }
  if (["accepted", "rejected", "cancelled", "expired"].includes(String(quote.status))) {
    return NextResponse.json({ ok: false, error: `No se puede enviar una cotización en estado ${quote.status}.` }, { status: 409 });
  }
  if (quote.expires_at && new Date(quote.expires_at).getTime() <= Date.now()) {
    await admin.from("quotes")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", quote.id)
      .eq("organization_id", auth.organizationId!);
    return NextResponse.json({ ok: false, error: "La cotización está vencida. Crea una revisión antes de enviarla." }, { status: 409 });
  }

  const previewUrl = `${appUrl}/cotizacion/${quote.public_token}`;
  const customerName = escapeHtml(quote.customer_name_snapshot || "Cliente");
  const quoteNumber = escapeHtml(quote.quote_number);
  const total = `RD$${Number(quote.total || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;
  const expires = quote.expires_at ? new Date(quote.expires_at).toLocaleDateString("es-DO") : "7 días";

  const html = `
  <div style="font-family:Arial,sans-serif;background:#f5f7fa;padding:28px;color:#101820">
    <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #dfe6ee;border-radius:14px;overflow:hidden">
      <div style="background:#0b0f14;padding:22px 26px;color:#fff">
        <div style="font-size:12px;letter-spacing:.12em;color:#79c9ef">TECHCOMM WIRELESS</div>
        <h1 style="font-size:22px;margin:7px 0 0">Cotización ${quoteNumber}</h1>
      </div>
      <div style="padding:26px">
        <p>Hola ${customerName},</p>
        <p>Adjuntamos el acceso seguro a tu cotización de Techcomm Wireless.</p>
        <div style="background:#f1f7fb;border-radius:10px;padding:16px;margin:20px 0">
          <div style="font-size:12px;color:#627386">TOTAL</div>
          <div style="font-size:28px;font-weight:700;margin-top:4px">${total}</div>
          <div style="font-size:13px;color:#627386;margin-top:6px">Válida hasta ${escapeHtml(expires)}</div>
        </div>
        <a href="${previewUrl}" style="display:inline-block;background:#0090d4;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Ver y responder cotización</a>
        <p style="font-size:12px;color:#748391;margin-top:24px">Este enlace corresponde únicamente a esta cotización. Si necesitas cambios, solicita una revisión desde la vista de la cotización.</p>
      </div>
    </div>
  </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [quote.customer_email_snapshot],
      subject: `Cotización ${quote.quote_number} · Techcomm Wireless`,
      html,
    }),
  });

  const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) {
    await admin.from("quote_events").insert({
      organization_id: auth.organizationId,
      quote_id: quote.id,
      event_type: "send_failed",
      actor_type: "user",
      actor_user_id: auth.user!.id,
      metadata: { channel: "email", provider_status: response.status },
    });
    return NextResponse.json({ ok: false, error: "No fue posible enviar la cotización por correo." }, { status: 502 });
  }

  const now = new Date().toISOString();
  const sentChannel = nextChannel(quote.sent_channel, "email");
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
    metadata: { channel: "email", provider_id: result.id ?? null, recipient: quote.customer_email_snapshot },
  });

  return NextResponse.json({ ok: true, preview_url: previewUrl, provider_id: result.id ?? null });
}
