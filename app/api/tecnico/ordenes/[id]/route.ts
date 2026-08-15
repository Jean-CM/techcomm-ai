import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

type VisitOutcome =
  | "completed"
  | "diagnosis_required"
  | "quote_or_part_required"
  | "customer_pending"
  | "not_applicable";

async function requireTechnician() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return { error: NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: technician } = await admin.from("technicians").select("id").eq("user_id", user.id).maybeSingle();
  if (!technician) return { error: NextResponse.json({ ok: false, error: "No tienes un perfil de técnico vinculado." }, { status: 403 }) };
  return { admin, technicianId: technician.id };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireTechnician();
  if (auth.error) return auth.error;
  const { admin, technicianId } = auth;

  const { data: order, error } = await admin!
    .from("work_orders")
    .select("id,order_number,status,equipment,brand,model,issue,technician_departed_at,technician_arrived_at,technician_completed_at,technician_visit_outcome,technician_visit_notes,technician_visit_outcome_at,customer_id,appointment_id,technician_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !order || order.technician_id !== technicianId) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  const [{ data: customer }, { data: appointment }] = await Promise.all([
    order.customer_id
      ? admin!.from("customers").select("full_name,address,sector,province,municipality,address_reference_1,address_reference_2,phone").eq("id", order.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    order.appointment_id
      ? admin!.from("appointments").select("starts_at").eq("id", order.appointment_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({ ok: true, order, customer, appointment });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireTechnician();
  if (auth.error) return auth.error;
  const { admin, technicianId } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "salio" | "llego" | "resolver_visita";
    visit_outcome?: VisitOutcome;
    visit_notes?: string;
    customer_acceptance?: "accepted" | "rejected";
    customer_acceptance_notes?: string;
    signature_base64?: string;
    photo_base64_list?: string[];
  };

  const { data: order } = await admin!
    .from("work_orders")
    .select("id,order_number,status,customer_id,appointment_id,technician_id")
    .eq("id", id)
    .maybeSingle();

  if (!order || order.technician_id !== technicianId) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };

  if (body.action === "salio") {
    updates.technician_departed_at = now;
  } else if (body.action === "llego") {
    updates.technician_arrived_at = now;
    updates.status = "in_progress";
  } else if (body.action === "resolver_visita") {
    const outcome = body.visit_outcome;
    const allowed: VisitOutcome[] = ["completed", "diagnosis_required", "quote_or_part_required", "customer_pending", "not_applicable"];
    if (!outcome || !allowed.includes(outcome)) {
      return NextResponse.json({ ok: false, error: "Selecciona el resultado de la visita." }, { status: 400 });
    }
    if (outcome !== "completed" && !String(body.visit_notes || "").trim()) {
      return NextResponse.json({ ok: false, error: "Agrega una nota técnica breve para este resultado." }, { status: 400 });
    }

    updates.technician_visit_outcome = outcome;
    updates.technician_visit_notes = String(body.visit_notes || "").trim() || null;
    updates.technician_visit_outcome_at = now;
    updates.technician_completed_at = now;

    if (outcome === "completed") {
      if (!body.customer_acceptance) return NextResponse.json({ ok: false, error: "Indica si el cliente acepta el trabajo realizado." }, { status: 400 });
      if (!body.signature_base64) return NextResponse.json({ ok: false, error: "Falta la firma del cliente." }, { status: 400 });
      if (!body.photo_base64_list?.length) return NextResponse.json({ ok: false, error: "Agrega al menos una foto de evidencia." }, { status: 400 });

      const photoPaths: string[] = [];
      for (let i = 0; i < body.photo_base64_list.length; i++) {
        const buffer = Buffer.from(body.photo_base64_list[i].split(",").pop() ?? "", "base64");
        const path = `${order.id}/photo-${Date.now()}-${i}.jpg`;
        const { error: uploadError } = await admin!.storage.from("service-evidence").upload(path, buffer, { contentType: "image/jpeg", upsert: true });
        if (!uploadError) photoPaths.push(path);
      }

      const signatureBuffer = Buffer.from(body.signature_base64.split(",").pop() ?? "", "base64");
      const signaturePath = `${order.id}/signature-${Date.now()}.png`;
      await admin!.storage.from("service-evidence").upload(signaturePath, signatureBuffer, { contentType: "image/png", upsert: true });

      updates.status = "completed";
      updates.completion_photo_paths = photoPaths;
      updates.customer_signature_path = signaturePath;
      updates.customer_acceptance = body.customer_acceptance;
      updates.customer_acceptance_notes = body.customer_acceptance_notes ?? null;
    } else if (outcome === "diagnosis_required") {
      updates.status = "on_hold";
    } else if (outcome === "quote_or_part_required") {
      updates.status = "pending_customer";
    } else if (outcome === "customer_pending") {
      updates.status = "pending_customer";
    } else {
      updates.status = "on_hold";
    }
  } else {
    return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
  }

  const { error } = await admin!.from("work_orders").update(updates).eq("id", order.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (body.action === "resolver_visita" && order.appointment_id) {
    await admin!.from("appointments").update({ status: "completed", updated_at: now }).eq("id", order.appointment_id);
  }

  if (body.action === "resolver_visita" && body.visit_outcome === "completed" && order.customer_id) {
    const { data: customer } = await admin!.from("customers").select("full_name,phone").eq("id", order.customer_id).maybeSingle();
    if (customer?.phone) {
      const digits = customer.phone.replace(/\D/g, "");
      const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      const e164 = /^(809|829|849)\d{7}$/.test(local) ? `+1${local}` : null;
      if (e164) {
        const message = `Hola ${customer.full_name ?? ""}, tu visita técnica de Techcomm Operations (orden ${order.order_number}) fue completada. ¿Cómo calificarías el servicio del 1 al 5?`;
        const sendResult = await sendWhatsAppMessage(e164, message);
        await admin!.from("service_surveys").insert({ organization_id: DEFAULT_ORG_ID, work_order_id: order.id, customer_id: order.customer_id, status: "sent" });
        if (sendResult.ok) await admin!.from("work_orders").update({ survey_sent_at: now }).eq("id", order.id);
      }
    }
  }

  return NextResponse.json({ ok: true, outcome: body.visit_outcome ?? null });
}
