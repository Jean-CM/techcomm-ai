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

type MissingField =
  | "customer_name"
  | "customer_phone"
  | "address"
  | "equipment"
  | "issue"
  | "scheduled_at"
  | "visit_fee_accepted";

const SERVICE_TIME_ZONE = "America/Santo_Domingo";
const SERVICE_OPEN_MINUTES = 8 * 60;
const SERVICE_CLOSE_MINUTES = 16 * 60;

function normalizePhone(value?: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function cleanText(value?: string) {
  return String(value ?? "").trim();
}

function normalizeText(value?: string) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function isCommercialInstallationRequest(issue: string) {
  const normalized = normalizeText(issue);
  const commercialSignals = [
    "instalacion de producto",
    "instalar producto",
    "instalar equipo nuevo",
    "instalacion equipo nuevo",
    "compra con instalacion",
    "entrega con instalacion",
    "venta con instalacion",
    "cotizacion",
    "factura de compra",
    "envio a domicilio",
  ];
  const repairSignals = [
    "no enciende",
    "no prende",
    "no funciona",
    "no seca",
    "no enfria",
    "no da imagen",
    "se apaga",
    "falla",
    "averia",
    "reparacion",
    "diagnostico",
  ];

  return commercialSignals.some((signal) => normalized.includes(signal))
    && !repairSignals.some((signal) => normalized.includes(signal));
}

function isPlaceholder(value: string) {
  const normalized = normalizeText(value);

  return [
    "no proporcionado",
    "no proporcionada",
    "no indicado",
    "no indicada",
    "no disponible",
    "no registrado",
    "no registrada",
    "desconocido",
    "desconocida",
    "pendiente",
    "por confirmar",
    "cliente",
    "customer",
    "n/a",
    "na",
    "sin nombre",
    "test",
    "prueba",
  ].includes(normalized);
}

function orderNumber() {
  const stamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100);
  return `OT-${stamp}${random}`;
}

function questionFor(field: MissingField) {
  const questions: Record<MissingField, string> = {
    customer_name: "¿A nombre de quién deseas registrar la visita?",
    customer_phone: "¿Cuál es el número de teléfono de contacto?",
    address: "¿En qué dirección o sector se encuentra el equipo?",
    equipment: "¿Qué equipo necesita revisión?",
    issue: "¿Qué falla presenta el equipo?",
    scheduled_at: "Nuestro horario de servicio es de 8:00 a. m. a 4:00 p. m. ¿Qué día y hora dentro de ese horario te convienen para la visita?",
    visit_fee_accepted: "La visita técnica cuesta RD$500 y se acredita a la factura si realizas la reparación con Techcomm. ¿Deseas continuar?",
  };
  return questions[field];
}

function minutesInServiceTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SERVICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function formatAppointment(date: Date) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: SERVICE_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function POST(request: Request) {
  if (!requireToolSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Payload;
  const phone = normalizePhone(body.customer_phone);
  const name = cleanText(body.customer_name);
  const address = cleanText(body.address);
  const equipment = cleanText(body.equipment);
  const issue = cleanText(body.issue);
  const source = body.source || "whatsapp";

  if (issue && isCommercialInstallationRequest(issue)) {
    return NextResponse.json({
      ok: false,
      status: "wrong_flow",
      flow: "product_sale_or_installation",
      error: "Esta herramienta es únicamente para averías y visitas diagnósticas.",
      next_question: "¿Deseas que registremos tus datos para preparar la compra o una cotización formal?",
      instruction: "No crees una orden de reparación ni asignes un técnico mediante esta herramienta. Continúa el flujo comercial y no menciones el costo de visita de RD$500.",
    }, { status: 409 });
  }

  const missingFields: MissingField[] = [];

  if (!name || isPlaceholder(name)) missingFields.push("customer_name");
  if (!/^(809|829|849)\d{7}$/.test(phone)) missingFields.push("customer_phone");
  if (!address || isPlaceholder(address)) missingFields.push("address");
  if (!equipment || isPlaceholder(equipment)) missingFields.push("equipment");
  if (!issue || isPlaceholder(issue)) missingFields.push("issue");

  let scheduledAt: Date | null = null;
  if (!body.scheduled_at || isPlaceholder(cleanText(body.scheduled_at))) {
    missingFields.push("scheduled_at");
  } else {
    const parsed = new Date(body.scheduled_at);
    if (Number.isNaN(parsed.getTime())) {
      missingFields.push("scheduled_at");
    } else {
      scheduledAt = parsed;
    }
  }

  if (body.visit_fee_accepted !== true) missingFields.push("visit_fee_accepted");

  if (missingFields.length) {
    const nextField = missingFields[0];
    return NextResponse.json({
      ok: false,
      status: "needs_more_information",
      missing_fields: missingFields,
      next_field: nextField,
      next_question: questionFor(nextField),
      service_hours: "8:00 a. m. a 4:00 p. m.",
      instruction: "No se creó ninguna orden. Haz solamente la pregunta indicada y vuelve a ejecutar la herramienta cuando tengas todos los datos reales. Nunca uses valores como 'No proporcionado'.",
    });
  }

  const appointmentMinutes = minutesInServiceTimeZone(scheduledAt!);
  if (appointmentMinutes < SERVICE_OPEN_MINUTES || appointmentMinutes > SERVICE_CLOSE_MINUTES) {
    return NextResponse.json({
      ok: false,
      status: "needs_more_information",
      missing_fields: ["scheduled_at"],
      next_field: "scheduled_at",
      next_question: "Nuestro horario de servicio es de 8:00 a. m. a 4:00 p. m. ¿Qué otra hora dentro de ese horario prefieres?",
      service_hours: "8:00 a. m. a 4:00 p. m.",
      instruction: "No se creó ninguna orden. Solicita otra hora y vuelve a ejecutar la herramienta con la nueva fecha en formato ISO 8601.",
    });
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
        full_name: name,
        address,
        sector: cleanText(body.sector) || customer.sector,
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
      .insert({
        full_name: name,
        phone,
        address,
        sector: cleanText(body.sector) || null,
        source,
      })
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

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      customer_id: customer.id,
      technician_id: technician?.id || null,
      starts_at: scheduledAt!.toISOString(),
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
  if (appointmentError) {
    return NextResponse.json({ ok: false, error: appointmentError.message }, { status: 500 });
  }

  const number = orderNumber();
  const { data: workOrder, error: orderError } = await supabase
    .from("work_orders")
    .insert({
      order_number: number,
      customer_id: customer.id,
      appointment_id: appointment.id,
      technician_id: technician?.id || null,
      equipment,
      brand: cleanText(body.brand) || null,
      model: cleanText(body.model) || null,
      issue,
      status: "scheduled",
      priority: "normal",
      source,
      visit_fee: 500,
      visit_fee_creditable: true,
    })
    .select("id,order_number,status,technician_id,appointment_id,visit_fee")
    .single();
  if (orderError) return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });

  const appointmentLabel = formatAppointment(scheduledAt!);
  return NextResponse.json({
    ok: true,
    status: "created",
    order: workOrder,
    customer,
    appointment,
    service_hours: "8:00 a. m. a 4:00 p. m.",
    technician: technician
      ? { id: technician.id, name: technician.full_name, phone: technician.phone }
      : null,
    technician_assigned: Boolean(technician),
    requires_manual_assignment: !technician,
    customer_message: technician
      ? `Listo, ${name}. Tu visita quedó programada para ${appointmentLabel}. La orden es ${number}. La visita cuesta RD$500 y ese monto se acredita a la factura si realizas la reparación con Techcomm. Ya se asignó un técnico disponible.`
      : `Listo, ${name}. Tu visita quedó programada para ${appointmentLabel}. La orden es ${number}. La visita cuesta RD$500 y ese monto se acredita a la factura si realizas la reparación con Techcomm. La asignación del técnico quedó pendiente en el CRM.`,
  });
}
