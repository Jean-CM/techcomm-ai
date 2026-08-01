import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";

type Payload = {
  customer_name?: string;
  customer_phone?: string;
  address?: string;
  sector?: string;
  equipment?: string;
  brand?: string;
  model?: string;
  issue?: string;
  scheduled_at?: string;
  source?: "whatsapp" | "phone" | "web" | "crm";
  visit_fee_accepted?: boolean;
};

function normalizePhone(value?: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function orderNumber() {
  const stamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100);
  return `OT-${stamp}${random}`;
}

export async function POST(request: Request) {
  if (!requireToolSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Payload;
  const phone = normalizePhone(body.customer_phone);
  const name = body.customer_name?.trim() || null;
  const address = body.address?.trim() || "";
  const equipment = body.equipment?.trim() || "Equipo por identificar";
  const issue = body.issue?.trim() || "Falla por confirmar";
  const source = body.source || "whatsapp";

  if (!/^(809|829|849)\d{7}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "El teléfono debe tener 10 dígitos y comenzar con 809, 829 o 849." }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ ok: false, error: "La dirección es requerida para crear la orden." }, { status: 400 });
  }
  if (body.visit_fee_accepted !== true) {
    return NextResponse.json({ ok: false, error: "El cliente debe aceptar el costo de visita de RD$500 antes de crear la orden." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existingCustomer, error: customerLookupError } = await supabase
    .from("customers")
    .select("id,full_name,phone,address,sector")
    .eq("phone", phone)
    .maybeSingle();
  if (customerLookupError) {
    return NextResponse.json({ ok: false, error: customerLookupError.message }, { status: 500 });
  }

  let customer = existingCustomer;
  if (customer) {
    const { data, error } = await supabase
      .from("customers")
      .update({
        full_name: name || customer.full_name,
        address,
        sector: body.sector?.trim() || customer.sector,
        source,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id)
      .select("id,full_name,phone,address,sector")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    customer = data;
  } else {
    const { data, error } = await supabase
      .from("customers")
      .insert({ full_name: name, phone, address, sector: body.sector?.trim() || null, source })
      .select("id,full_name,phone,address,sector")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    customer = data;
  }

  const { data: availableTechnicians, error: technicianError } = await supabase
    .from("technicians")
    .select("id,full_name,phone,specialties,status")
    .eq("active", true)
    .eq("status", "available");
  if (technicianError) return NextResponse.json({ ok: false, error: technicianError.message }, { status: 500 });

  const technicianIds = (availableTechnicians ?? []).map((item) => item.id);
  const workload = new Map<string, number>();
  if (technicianIds.length) {
    const { data: activeOrders, error: workloadError } = await supabase
      .from("work_orders")
      .select("technician_id,status")
      .in("technician_id", technicianIds)
      .not("status", "in", "(completed,cancelled)");
    if (workloadError) return NextResponse.json({ ok: false, error: workloadError.message }, { status: 500 });
    for (const order of activeOrders ?? []) {
      if (order.technician_id) workload.set(order.technician_id, (workload.get(order.technician_id) || 0) + 1);
    }
  }

  const technician = [...(availableTechnicians ?? [])].sort((a, b) => {
    const loadDifference = (workload.get(a.id) || 0) - (workload.get(b.id) || 0);
    if (loadDifference !== 0) return loadDifference;
    return a.full_name.localeCompare(b.full_name);
  })[0] || null;

  let appointment: { id: string; starts_at: string; technician_id: string | null } | null = null;
  if (body.scheduled_at) {
    const parsed = new Date(body.scheduled_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ ok: false, error: "La fecha y hora de la cita no son válidas." }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        customer_id: customer.id,
        technician_id: technician?.id || null,
        starts_at: parsed.toISOString(),
        address,
        status: "scheduled",
        confirmation_status: "pending",
        technician_confirmation_status: technician ? "confirmed" : "pending",
        technician_confirmation_at: technician ? new Date().toISOString() : null,
        requires_manual_assignment: !technician,
        notes: `${equipment}: ${issue}`,
      })
      .select("id,starts_at,technician_id")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    appointment = data;
  }

  const number = orderNumber();
  const { data: workOrder, error: orderError } = await supabase
    .from("work_orders")
    .insert({
      order_number: number,
      customer_id: customer.id,
      appointment_id: appointment?.id || null,
      technician_id: technician?.id || null,
      equipment,
      brand: body.brand?.trim() || null,
      model: body.model?.trim() || null,
      issue,
      status: technician ? "assigned" : "new",
      priority: "normal",
      source,
      visit_fee: 500,
      visit_fee_creditable: true,
    })
    .select("id,order_number,status,technician_id,appointment_id,visit_fee")
    .single();
  if (orderError) return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    order: workOrder,
    customer,
    appointment,
    technician: technician
      ? { id: technician.id, name: technician.full_name, phone: technician.phone }
      : null,
    requires_manual_assignment: !technician,
    customer_message: technician
      ? `Orden ${number} creada correctamente. La visita tiene un costo de RD$500, acreditable a la factura si se realiza la reparación. Se asignó un técnico disponible.`
      : `Orden ${number} creada correctamente. La visita tiene un costo de RD$500, acreditable a la factura si se realiza la reparación. La asignación del técnico quedó pendiente en el CRM.`,
  });
}
