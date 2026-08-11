import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const MAX_ROWS_PER_REQUEST = 1000;
const BATCH_SIZE = 500;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function text(value: unknown, max = 500) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : null;
}
function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}
function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
function bool(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "si", "sí", "x"].includes(String(value ?? "").trim().toLowerCase());
}
function itemType(value: unknown) {
  const normalized = String(value ?? "product").trim().toLowerCase();
  return ["product", "equipment", "part", "accessory"].includes(normalized) ? normalized : "product";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as null | {
    source_id?: string;
    rows?: Array<Record<string, unknown>>;
    watermark?: string;
  };

  const sourceId = String(body?.source_id ?? "").trim();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!sourceId || !rows.length) {
    return NextResponse.json({ ok: false, error: "source_id y rows son requeridos." }, { status: 400 });
  }
  if (rows.length > MAX_ROWS_PER_REQUEST) {
    return NextResponse.json({ ok: false, error: `Máximo ${MAX_ROWS_PER_REQUEST} filas por lote.` }, { status: 413 });
  }

  const admin = getSupabaseAdmin();
  const { data: source, error: sourceError } = await admin
    .from("data_sources")
    .select("id,organization_id,name,connection_mode,status,secret_ref")
    .eq("id", sourceId)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (sourceError || !source) return NextResponse.json({ ok: false, error: "Fuente no encontrada." }, { status: 404 });
  if (source.status !== "active") return NextResponse.json({ ok: false, error: "La fuente no está activa." }, { status: 409 });
  if (!new Set(["push_agent", "api_pull", "private_network"]).has(source.connection_mode)) {
    return NextResponse.json({ ok: false, error: "Esta fuente no admite sincronización por API." }, { status: 409 });
  }

  const secretRef = String(source.secret_ref ?? "").trim();
  const expectedSecret = secretRef ? process.env[secretRef] : undefined;
  if (!secretRef || !expectedSecret) {
    return NextResponse.json({ ok: false, error: "La credencial de sincronización no está configurada." }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const presented = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!presented || !safeEqual(presented, expectedSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const normalized = rows.map((row) => {
    const sku = text(row.sku ?? row.codigo ?? row.code, 120);
    const name = text(row.name ?? row.nombre ?? row.producto ?? row.pieza, 240);
    if (!sku || !name) return null;
    const stock = integer(row.stock ?? row.stock_total);
    const reservedStock = Math.min(stock, integer(row.reserved_stock ?? row.stock_reservado ?? row.reservado));
    const salePrice = amount(row.sale_price ?? row.precio_venta ?? row.price ?? row.precio);
    const maxDiscountRaw = amount(row.max_discount_pct ?? row.descuento_maximo);
    const maxDiscount = Math.min(1, maxDiscountRaw > 1 ? maxDiscountRaw / 100 : maxDiscountRaw);
    return {
      organization_id: DEFAULT_ORG_ID,
      sku,
      barcode: text(row.barcode ?? row.codigo_barras, 120),
      name,
      piece_name: text(row.piece_name ?? row.pieza, 240) ?? name,
      description: text(row.description ?? row.descripcion, 1500),
      item_type: itemType(row.item_type ?? row.tipo),
      category: text(row.category ?? row.categoria, 160) ?? "General",
      subcategory: text(row.subcategory ?? row.subcategoria, 160),
      brand: text(row.brand ?? row.marca, 160),
      model: text(row.model ?? row.modelo, 160),
      supplier: text(row.supplier ?? row.proveedor, 200),
      warehouse_location: text(row.warehouse_location ?? row.ubicacion ?? row.almacen, 200),
      unit_cost: amount(row.unit_cost ?? row.costo_unitario ?? row.costo),
      sale_price: salePrice,
      price: salePrice,
      max_discount_pct: maxDiscount,
      currency: text(row.currency ?? row.moneda, 8) ?? "DOP",
      stock,
      reserved_stock: reservedStock,
      pending_stock: integer(row.pending_stock ?? row.stock_pendiente ?? row.por_recibir),
      min_stock: integer(row.min_stock ?? row.stock_minimo ?? row.minimo),
      serial_tracking: bool(row.serial_tracking ?? row.control_serial),
      lot_tracking: bool(row.lot_tracking ?? row.control_lote),
      warranty_days: integer(row.warranty_days ?? row.garantia_dias),
      active: row.active === undefined ? true : bool(row.active),
      last_inventory_at: now,
      updated_at: now,
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!normalized.length) return NextResponse.json({ ok: false, error: "El lote no contiene filas válidas con SKU y nombre." }, { status: 400 });

  let written = 0;
  for (let start = 0; start < normalized.length; start += BATCH_SIZE) {
    const batch = normalized.slice(start, start + BATCH_SIZE);
    const { data, error } = await admin.from("products").upsert(batch, { onConflict: "sku" }).select("id");
    if (error) {
      await admin.from("data_sources").update({ status: "error", updated_at: now }).eq("id", sourceId);
      return NextResponse.json({ ok: false, error: "Falló la escritura del lote.", written }, { status: 500 });
    }
    written += data?.length ?? batch.length;
  }

  await admin.from("data_sources").update({ last_sync_at: now, status: "active", updated_at: now }).eq("id", sourceId);

  return NextResponse.json({
    ok: true,
    source_id: sourceId,
    source: source.name,
    rows_read: rows.length,
    rows_written: written,
    rejected: rows.length - normalized.length,
    watermark: text(body?.watermark, 250),
    synced_at: now,
  });
}
