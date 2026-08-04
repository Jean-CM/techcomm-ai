import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = {
  action?: "customer" | "appointment" | "order";
  customer_id?: string;
  customer_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  sector?: string;
  technician_id?: string | null;
  starts_at?: string;
  notes?: string;
  equipment?: string;
  brand?: string;
  model?: string;
  issue?: string;
  priority?: string;
  actor_name?: string;
  actor_role?: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function orderNumber() {
  return `OT-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
}

async function resolveCustomer(supabase: ReturnType<typeof getSupabaseAdmin>, body: Payload) {
  if (body.customer_id) {
    const { data, error } = await supabase.from("customers").select("*").eq("id", body.customer_id).single();
    return { customer: data, error };
  }

  const phone = normalizePhone(clean(body.phone));
  const name = clean(body.customer_name);
  if (!name || !/^(809|829|849)\d{7}$/.test(phone)) {
    return { customer: null, error: new Error("Nombre y teléfono dominicano válido son requeridos.") };
  }

  const { data: existing } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
  const values = {
    full_name: name,
    phone,
    email: clean(body.email) || null,
    address: clean(body.address) || null,
    sector: clean(body.sector) || null,
    source: "presencial",
    updated_at: new Date().toISOString(),
  };

  const query = existing?.id
    ? supabase.from("customers").update(values).eq("id", existing.id)
    : supabase.from("customers").insert(values);
  const { data, error } = await query.select().single();
  return { customer: data, error };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Payload;
  if (!body.action) {
    return NextResponse.json({ ok: false, error: "La gestión es requerida." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { customer, error: customerError } = await resolveCustomer(supabase, body);
  if (customerError || !customer) {
    return NextResponse.json({ ok: false, error: customerError?.message || "No fue posible identificar al cliente." }, { status: 400 });
  }

  if (body.action === "customer") {
    return NextResponse.json({ ok: true, customer });
  }

  if (body.action === "appointment") {
    const startsAt = new Date(clean(body.starts_at));
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ ok: false, error: "La fecha y hora no son válidas." }, { status: 400 });
    }

    const { data: appointment, error } = await supabase.from("appointments").insert({
      customer_id: customer.id,
      technician_id: body.technician_id || null,
      starts_at: startsAt.toISOString(),
      address: clean(body.address) || customer.address || "Pendiente de confirmar",
      status: "scheduled",
      confirmation_status: "pending",
      technician_confirmation_status: body.technician_id ? "confirmed" : "pending",
      technician_confirmation_at: body.technician_id ? new Date().toISOString() : null,
      requires_manual_assignment: !body.technician_id,
      notes: clean(body.notes) || "Gestión presencial",
      updated_at: new Date().toISOString(),
    }).select().single();

    if (error || !appointment) {
      return NextResponse.json({ ok: false, error: error?.message || "No fue posible crear la cita." }, { status: 500 });
    }

    const confirmationCallAt = new Date(startsAt.getTime() + 2 * 60 * 1000).toISOString();
    await supabase.from("call_reminders").upsert({
      appointment_id: appointment.id,
      call_type: "appointment_confirmation_test",
      scheduled_for: confirmationCallAt,
      appointment_starts_at: startsAt.toISOString(),
      customer_phone: customer.phone,
      customer_name: customer.full_name,
      status: "pending",
      attempts: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "appointment_id,call_type" });

    return NextResponse.json({ ok: true, customer, appointment, confirmation_call_test_at: confirmationCallAt });
  }

  const equipment = clean(body.equipment);
  const issue = clean(body.issue);
  if (!equipment || !issue) {
    return NextResponse.json({ ok: false, error: "El equipo y la falla son requeridos." }, { status: 400 });
  }

  const { data: order, error } = await supabase.from("work_orders").insert({
    order_number: orderNumber(),
    customer_id: customer.id,
    technician_id: body.technician_id || null,
    equipment,
    brand: clean(body.brand) || null,
    model: clean(body.model) || null,
    issue,
    status: body.technician_id ? "assigned" : "new",
    priority: clean(body.priority) || "normal",
    source: "presencial",
    visit_fee: 500,
    visit_fee_creditable: true,
  }).select().single();

  if (error || !order) {
    return NextResponse.json({ ok: false, error: error?.message || "No fue posible crear la orden." }, { status: 500 });
  }

  await supabase.from("crm_audit_log").insert({
    entity_type: "work_orders",
    entity_id: order.id,
    action: "manual_management",
    actor_name: clean(body.actor_name) || "Usuario CRM",
    actor_role: clean(body.actor_role) || "unknown",
    after_data: order,
  });

  return NextResponse.json({ ok: true, customer, order });
}
