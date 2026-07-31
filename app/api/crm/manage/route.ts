import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ManagementPayload = {
  type?: "Cliente" | "Producto" | "Cita" | "Orden" | "Cotización" | "Venta" | "Técnico";
  name?: string;
  detail?: string;
  secondary?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as ManagementPayload;
  const type = body.type;
  const name = clean(body.name);
  const detail = clean(body.detail);
  const secondary = clean(body.secondary);

  if (!type || !name) {
    return NextResponse.json({ ok: false, error: "type and name are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (type === "Cliente") {
    const phone = normalizePhone(detail);
    if (!/^(809|829|849)\d{7}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "El teléfono debe tener 10 dígitos y comenzar con 809, 829 o 849." }, { status: 400 });
    }
    const { data, error } = await supabase.from("customers").upsert({ full_name: name, phone, address: secondary || null, source: "presencial", updated_at: new Date().toISOString() }, { onConflict: "phone" }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: data });
  }

  if (type === "Producto") {
    const { data, error } = await supabase.from("products").insert({ sku: `MAN-${Date.now()}`, name, piece_name: name, category: detail || "General", brand: secondary || null, stock: 0, reserved_stock: 0, active: true }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: data });
  }

  if (type === "Técnico") {
    const phone = normalizePhone(detail);
    if (!/^(809|829|849)\d{7}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "El teléfono del técnico debe tener 10 dígitos y comenzar con 809, 829 o 849." }, { status: 400 });
    }
    const specialties = secondary ? secondary.split(",").map((item) => item.trim()).filter(Boolean) : [];
    const { data, error } = await supabase.from("technicians").insert({ full_name: name, phone, specialties, zones: [], status: "available", active: true, whatsapp_enabled: true, notification_status: "ready" }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: data });
  }

  if (type === "Cita") {
    const startsAt = new Date(secondary);
    if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ ok: false, error: "La fecha y hora no son válidas." }, { status: 400 });
    const { data: customer } = await supabase.from("customers").select("id").ilike("full_name", name).limit(1).maybeSingle();
    const { data, error } = await supabase.from("appointments").insert({ customer_id: customer?.id ?? null, starts_at: startsAt.toISOString(), address: "Pendiente de confirmar", status: "scheduled", confirmation_status: "pending", technician_confirmation_status: "pending", notes: detail || "Servicio por definir" }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: data });
  }

  if (type === "Orden") {
    const { data: customer } = await supabase.from("customers").select("id").ilike("full_name", name).limit(1).maybeSingle();
    const { data, error } = await supabase.from("work_orders").insert({ order_number: `OT-${String(Date.now()).slice(-6)}`, customer_id: customer?.id ?? null, equipment: secondary || "Equipo por identificar", issue: detail || "Pendiente de descripción", status: "new", source: "presencial", visit_fee: 500, visit_fee_creditable: true }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: data });
  }

  if (type === "Cotización") {
    const { data: customer } = await supabase.from("customers").select("id").ilike("full_name", name).limit(1).maybeSingle();
    const total = Number(secondary.replace(/[^0-9.]/g, "")) || 0;
    const { data, error } = await supabase.from("quotes").insert({ quote_number: `CT-${String(Date.now()).slice(-6)}`, customer_id: customer?.id ?? null, status: "draft", subtotal: total, total, notes: detail || null }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: data });
  }

  if (type === "Venta") {
    const { data: customer } = await supabase.from("customers").select("id").ilike("full_name", name).limit(1).maybeSingle();
    const { data: product } = await supabase.from("products").select("id,price").ilike("name", `%${detail}%`).limit(1).maybeSingle();
    const unitPrice = Number(secondary.replace(/[^0-9.]/g, "")) || Number(product?.price) || 0;
    const { data, error } = await supabase.from("sales").insert({ customer_id: customer?.id ?? null, product_id: product?.id ?? null, quantity: 1, unit_price: unitPrice, status: "lead", source: "presencial" }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: data });
  }

  return NextResponse.json({ ok: false, error: "Unsupported type" }, { status: 400 });
}
