import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

async function recomputeProcurementFlag(admin: ReturnType<typeof getSupabaseAdmin>, workOrderId: string) {
  const { data: parts } = await admin
    .from("work_order_required_parts")
    .select("product_id, products(available_stock, inventory_status)")
    .eq("work_order_id", workOrderId);

  const needsProcurement = (parts ?? []).some((row) => {
    const product = row.products as unknown as { available_stock: number | null; inventory_status: string } | null;
    return !product || product.inventory_status === "out" || (product.available_stock ?? 0) <= 0;
  });

  await admin.from("work_orders").update({ parts_procurement_needed: needsProcurement }).eq("id", workOrderId);
  return needsProcurement;
}

export async function GET(request: Request) {
  const workOrderId = new URL(request.url).searchParams.get("work_order_id");
  if (!workOrderId) return NextResponse.json({ ok: false, error: "work_order_id es requerido" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("work_order_required_parts")
    .select("id,product_id,quantity,products(name,available_stock,inventory_status)")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, parts: data ?? [] });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { work_order_id?: string; product_id?: string; quantity?: number };
  if (!body.work_order_id || !body.product_id) {
    return NextResponse.json({ ok: false, error: "work_order_id y product_id son requeridos" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("work_order_required_parts").insert({
    organization_id: DEFAULT_ORG_ID,
    work_order_id: body.work_order_id,
    product_id: body.product_id,
    quantity: body.quantity ?? 1,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const needsProcurement = await recomputeProcurementFlag(admin, body.work_order_id);
  return NextResponse.json({ ok: true, parts_procurement_needed: needsProcurement });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; work_order_id?: string };
  if (!body.id || !body.work_order_id) {
    return NextResponse.json({ ok: false, error: "id y work_order_id son requeridos" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("work_order_required_parts").delete().eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const needsProcurement = await recomputeProcurementFlag(admin, body.work_order_id);
  return NextResponse.json({ ok: true, parts_procurement_needed: needsProcurement });
}
