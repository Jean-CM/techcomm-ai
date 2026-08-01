import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = {
  id?: string;
  name?: string;
  description?: string;
  unit_cost?: number;
  sale_price?: number;
  max_discount_pct?: number;
  stock?: number;
  reserved_stock?: number;
  installation_price?: number;
  delivery_price?: number;
  installation_includes_delivery?: boolean;
};

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Payload;
  if (!body.id) return NextResponse.json({ ok: false, error: "El producto es requerido." }, { status: 400 });

  const salePrice = amount(body.sale_price);
  const maxDiscount = Math.min(1, amount(body.max_discount_pct));
  const values = {
    name: body.name?.trim() || undefined,
    description: body.description?.trim() || null,
    unit_cost: amount(body.unit_cost),
    sale_price: salePrice,
    price: salePrice,
    max_discount_pct: maxDiscount,
    minimum_authorized_price: salePrice * (1 - maxDiscount),
    stock: Math.floor(amount(body.stock)),
    reserved_stock: Math.floor(amount(body.reserved_stock)),
    installation_price: amount(body.installation_price),
    delivery_price: amount(body.delivery_price),
    installation_includes_delivery: body.installation_includes_delivery !== false,
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("products").update(values).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, product: data });
}
