import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

const WARRANTY_POLICY_PLACEHOLDER =
  "[Texto temporal — pendiente de confirmar con la empresa] Su reparación cuenta con garantía de 30 días sobre la pieza reemplazada y la mano de obra. Si el equipo presenta la misma falla dentro de ese periodo, la revisión es sin costo adicional. Para reembolsos, contacte a Techcomm Wireless dentro de las 48 horas posteriores al servicio.";

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
    const { error } = await admin!.from("work_order_materials").insert({
      organization_id: DEFAULT_ORG_ID,
      work_order_id: order.id,
      product_id: body.product_id ?? null,
      product_name: body.product_name,
      quantity: body.quantity ?? 1,
      unit_price: body.unit_price ?? null,
      recorded_by: userId,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };

  if (body.action === "salio") updates.technician_departed_at = now;
  else if (body.action === "llego") { updates.technician_arrived_at = now; updates.status = "in_progress"; }
  else if (body.action === "termino") { updates.technician_completed_at = now; updates.status = "completed"; }
  else return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });

  const { error } = await admin!.from("work_orders").update(updates).eq("id", order.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

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
