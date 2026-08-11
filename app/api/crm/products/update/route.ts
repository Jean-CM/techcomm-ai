import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = {
  id?: string;
  sku?: string;
  barcode?: string;
  name?: string;
  piece_name?: string;
  description?: string;
  item_type?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  supplier?: string;
  warehouse_location?: string;
  unit_cost?: number;
  sale_price?: number;
  max_discount_pct?: number;
  stock?: number;
  reserved_stock?: number;
  pending_stock?: number;
  min_stock?: number;
  serial_tracking?: boolean;
  lot_tracking?: boolean;
  warranty_days?: number;
  installation_price?: number;
  delivery_price?: number;
  installation_includes_delivery?: boolean;
};

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Payload;
  if (!body.id) return NextResponse.json({ ok: false, error: "El producto es requerido." }, { status: 400 });

  const name = text(body.name);
  if (!name) return NextResponse.json({ ok: false, error: "El nombre del producto es requerido." }, { status: 400 });

  const allowedTypes = new Set(["product", "equipment", "part", "accessory"]);
  const itemType = allowedTypes.has(String(body.item_type)) ? String(body.item_type) : "product";
  const salePrice = amount(body.sale_price);
  const maxDiscount = Math.min(1, amount(body.max_discount_pct));
  const stock = Math.floor(amount(body.stock));
  const reservedStock = Math.min(stock, Math.floor(amount(body.reserved_stock)));

  const values = {
    sku: text(body.sku),
    barcode: text(body.barcode),
    name,
    piece_name: text(body.piece_name),
    description: text(body.description),
    item_type: itemType,
    category: text(body.category),
    subcategory: text(body.subcategory),
    brand: text(body.brand),
    model: text(body.model),
    supplier: text(body.supplier),
    warehouse_location: text(body.warehouse_location),
    unit_cost: amount(body.unit_cost),
    sale_price: salePrice,
    price: salePrice,
    max_discount_pct: maxDiscount,
    stock,
    reserved_stock: reservedStock,
    pending_stock: Math.floor(amount(body.pending_stock)),
    min_stock: Math.floor(amount(body.min_stock)),
    serial_tracking: Boolean(body.serial_tracking),
    lot_tracking: Boolean(body.lot_tracking),
    warranty_days: Math.floor(amount(body.warranty_days)),
    installation_price: amount(body.installation_price),
    delivery_price: amount(body.delivery_price),
    installation_includes_delivery: Boolean(body.installation_includes_delivery),
    last_inventory_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .update(values)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    const duplicateSku = error.message.toLowerCase().includes("duplicate") && error.message.toLowerCase().includes("sku");
    return NextResponse.json({ ok: false, error: duplicateSku ? "Ese SKU ya está asignado a otro producto." : error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, product: data });
}
