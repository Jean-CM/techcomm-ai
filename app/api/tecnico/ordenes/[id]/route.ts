import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

const WARRANTY_POLICY_PLACEHOLDER =
  "Garantía Techcomm: 30 días a partir de la entrega del equipo, cubriendo la misma reparación realizada. Fuera de este periodo, o si el equipo presenta maltrato, rotura, humedad, o intervención de un taller no autorizado, el servicio se considera fuera de garantía. Si su equipo tiene garantía de fábrica, tienda o distribuidor vigente, contáctenos para validar cuál aplica a su caso.";

async function requireTechnician(request: Request) {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return { error: NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: technician } = await admin.from("technicians").select("id").eq("user_id", user.id).maybeSingle();
  if (!technician) return { error: NextResponse.json({ ok: false, error: "No tienes un perfil de técnico vinculado." }, { status: 403 }) };

  return { admin, technicianId: technician.id, userId: user.id };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireTechnician(_request);
  if (auth.error) return auth.error;
  const { admin, technicianId } = auth;

  const { data: order, error } = await admin!
    .from("work_orders")
    .select("id,order_number,status,equipment,brand,model,issue,technician_departed_at,technician_arrived_at,technician_completed_at,customer_id,appointment_id,technician_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !order || order.technician_id !== technicianId) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  const [{ data: customer }, { data: appointment }, { data: materials }] = await Promise.all([
    order.customer_id ? admin!.from("customers").select("full_name,address,sector,phone").eq("id", order.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    order.appointment_id ? admin!.from("appointments").select("starts_at").eq("id", order.appointment_id).maybeSingle() : Promise.resolve({ data: null }),
    admin!.from("work_order_materials").select("id,product_name,quantity,unit_price").eq("work_order_id", order.id),
  ]);

  return NextResponse.json({ ok: true, order, customer, appointment, materials: materials ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireTechnician(request);
  if (auth.error) return auth.error;
  const { admin, technicianId, userId } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "salio" | "llego" | "termino" | "add_material";
    product_id?: string;
    product_name?: string;
    quantity?: number;
    unit_price?: number;
    is_additional_purchase?: boolean;
  };

  const { data: order } = await admin!
    .from("work_orders")
    .select("id,order_number,status,customer_id,technician_id")
    .eq("id", id)
    .maybeSingle();

  if (!order || order.technician_id !== technicianId) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  if (body.action === "add_material") {
    if (!body.product_name) return NextResponse.json({ ok: false, error: "product_name es requerido" }, { status: 400 });
    const quantity = body.quantity ?? 1;
    const unitPrice = body.unit_price ?? null;
    let quoteId: string | null = null;
    let quoteSent = false;

    if (body.is_additional_purchase && order.customer_id) {
      const { data: customer } = await admin!.from("customers").select("full_name,phone,address,sector").eq("id", order.customer_id).maybeSingle();
      const subtotal = (unitPrice ?? 0) * quantity;
      const quoteNumber = `CT-${Date.now().toString().slice(-8)}`;
      const customerAddress = [customer?.address, customer?.sector].filter(Boolean).join(", ");

      const { data: quote } = await admin!.from("quotes").insert({
        quote_number: quoteNumber,
        customer_id: order.customer_id,
        work_order_id: order.id,
        status: "draft",
        subtotal,
        tax: 0,
        total: subtotal,
        customer_name_snapshot: customer?.full_name ?? null,
        customer_phone_snapshot: customer?.phone ?? null,
        customer_address_snapshot: customerAddress || null,
        warranty_note: "La garantía aplica según el producto y las condiciones indicadas en esta cotización.",
        notes: "Compra adicional reportada por el técnico durante la visita.",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).select("id,public_token,quote_number,total").single();

      if (quote) {
        quoteId = quote.id;
        await admin!.from("quote_items").insert({
          quote_id: quote.id,
          product_id: body.product_id ?? null,
          description: body.product_name,
          quantity,
          unit_price: unitPrice ?? 0,
          discount_pct: 0,
          discount_amount: 0,
          line_total: subtotal,
        });

        if (customer?.phone) {
          const digits = customer.phone.replace(/\D/g, "");
          const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
          const e164 = /^(809|829|849)\d{7}$/.test(local) ? `+1${local}` : null;
          if (e164) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
            const previewUrl = `${appUrl}/cotizacion/${quote.public_token}`;
            const message =
              `Hola ${customer.full_name ?? ""}, durante la visita técnica de la orden ${order.order_number} se agregó una compra adicional:\n\n` +
              `${body.product_name} × ${quantity} — RD$${subtotal.toLocaleString("es-DO")}\n\n` +
              `Puedes ver y confirmar la cotización aquí: ${previewUrl}`;
            const result = await sendWhatsAppMessage(e164, message);
            if (result.ok) {
              quoteSent = true;
              await admin!.from("quotes").update({ sent_at: new Date().toISOString(), sent_channel: "whatsapp", status: "sent" }).eq("id", quote.id);
            }
          }
        }
      }
    }

    const { error } = await admin!.from("work_order_materials").insert({
      organization_id: DEFAULT_ORG_ID,
      work_order_id: order.id,
      product_id: body.product_id ?? null,
      product_name: body.product_name,
      quantity,
      unit_price: unitPrice,
      is_additional_purchase: Boolean(body.is_additional_purchase),
      quote_id: quoteId,
      recorded_by: userId,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, quote_created: Boolean(quoteId), quote_sent: quoteSent });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };

  if (body.action === "salio") updates.technician_departed_at = now;
  else if (body.action === "llego") { updates.technician_arrived_at = now; updates.status = "in_progress"; }
  else if (body.action === "termino") { updates.technician_completed_at = now; updates.status = "completed"; }
  else return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });

  const { error } = await admin!.from("work_orders").update(updates).eq("id", order.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (body.action === "termino") {
    const { data: orderWithAppointment } = await admin!.from("work_orders").select("appointment_id").eq("id", order.id).maybeSingle();
    if (orderWithAppointment?.appointment_id) {
      await admin!.from("appointments").update({ status: "completed", updated_at: now }).eq("id", orderWithAppointment.appointment_id);
    }
  }

  if (body.action === "termino" && order.customer_id) {
    const { data: customer } = await admin!.from("customers").select("full_name,phone").eq("id", order.customer_id).maybeSingle();
    if (customer?.phone) {
      const digits = customer.phone.replace(/\D/g, "");
      const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      const e164 = /^(809|829|849)\d{7}$/.test(local) ? `+1${local}` : null;
      if (e164) {
        const surveyMessage =
          `Hola ${customer.full_name ?? ""}, tu visita técnica de Techcomm Wireless (orden ${order.order_number}) quedó marcada como completada.\n\n` +
          `¿Cómo calificarías el servicio del 1 al 5? Responde con un número.\n\n` +
          WARRANTY_POLICY_PLACEHOLDER;
        const sendResult = await sendWhatsAppMessage(e164, surveyMessage);
        await admin!.from("service_surveys").insert({
          organization_id: DEFAULT_ORG_ID,
          work_order_id: order.id,
          customer_id: order.customer_id,
          status: "sent",
        });
        if (sendResult.ok) await admin!.from("work_orders").update({ survey_sent_at: now }).eq("id", order.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
