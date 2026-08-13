import { NextResponse } from "next/server";
import { requireOrgRole, DEFAULT_ORG_ID } from "@/lib/require-org-role";

export async function POST(request: Request) {
  const auth = await requireOrgRole(["owner", "admin", "manager", "agent"]);
  if ("error" in auth) return auth.error;
  const admin = auth.admin!;

  const body = (await request.json().catch(() => ({}))) as {
    customer_name?: string;
    customer_phone?: string;
    brand?: string;
    model?: string;
    imei?: string;
    issue?: string;
    operator_ticket?: string;
    intake_channel?: string;
    origin_branch?: string;
    warranty_type?: string;
  };

  if (!body.customer_name || !body.brand || !body.issue) {
    return NextResponse.json({ ok: false, error: "customer_name, brand e issue son requeridos" }, { status: 400 });
  }

  // Find or create the customer by phone, same convention used elsewhere.
  let customerId: string | null = null;
  if (body.customer_phone) {
    const { data: existing } = await admin.from("customers").select("id").eq("phone", body.customer_phone).eq("organization_id", DEFAULT_ORG_ID).maybeSingle();
    customerId = existing?.id ?? null;
  }
  if (!customerId) {
    const { data: created, error: customerError } = await admin.from("customers").insert({
      organization_id: DEFAULT_ORG_ID,
      full_name: body.customer_name,
      phone: body.customer_phone ?? null,
    }).select("id").single();
    if (customerError) return NextResponse.json({ ok: false, error: customerError.message }, { status: 500 });
    customerId = created.id;
  }

  const { data: numberResult } = await admin.rpc("next_order_number");

  const { data: order, error } = await admin.from("work_orders").insert({
    organization_id: DEFAULT_ORG_ID,
    order_number: numberResult ?? `OT-${Date.now()}`,
    customer_id: customerId,
    service_line: "celulares",
    order_type: "reparacion_instalacion",
    service_category: "diagnostico",
    status: "new",
    brand: body.brand,
    model: body.model ?? null,
    equipment: "Celular / dispositivo",
    issue: body.issue,
    imei: body.imei ?? null,
    operator_ticket: body.operator_ticket ?? null,
    intake_channel: body.intake_channel ?? "casa_central",
    origin_branch: body.origin_branch ?? "CASA MATRIZ MASTER",
    current_branch: "CASA MATRIZ MASTER",
    warranty_type: body.warranty_type ?? "fuera_garantia",
  }).select("id,order_number").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, order });
}
