import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const MAX_ROWS_PER_REQUEST = 1000;
const BATCH_SIZE = 500;
const MAX_BODY_BYTES = 3_500_000;
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function expectedSignature(secret: string, timestamp: string, rawBody: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
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
  const rawBody = await request.text();
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload vacío o demasiado grande." }, { status: 413 });
  }

  let body: null | { source_id?: string; rows?: Array<Record<string, unknown>>; watermark?: string } = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

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
  const secret = secretRef ? process.env[secretRef] : undefined;
  if (!secretRef || !secret) {
    return NextResponse.json({ ok: false, error: "La credencial de sincronización no está configurada." }, { status: 503 });
  }

  const timestamp = request.headers.get("x-techcomm-timestamp")?.trim() ?? "";
  const signature = request.headers.get("x-techcomm-signature")?.trim() ?? "";
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!timestamp || !Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
    return NextResponse.json({ ok: false, error: "Firma expirada o timestamp inválido." }, { status: 401 });
  }
  const expected = expectedSignature(secret, timestamp, rawBody);
  if (!signature || !safeEqual(signature, expected)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: dataset } = await admin
    .from("datasets")
    .select("id")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("data_source_id", sourceId)
    .maybeSingle();
  const { data: job } = dataset
    ? await admin.from("sync_jobs").select("id").eq("organization_id", DEFAULT_ORG_ID).eq("dataset_id", dataset.id).maybeSingle()
    : { data: null as null | { id: string } };

  const now = new Date().toISOString();
  let syncRunId: string | null = null;
  if (job) {
    const { data: run } = await admin
      .from("sync_runs")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        sync_job_id: job.id,
        status: "running",
        started_at: now,
        rows_read: rows.length,
        rows_written: 0,
        metadata: { source_id: sourceId, transport: "hmac_sha256", watermark: text(body?.watermark, 250) },
      })
      .select("id")
      .single();
    syncRunId = run?.id ?? null;
  }

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

  if (!normalized.length) {
    if (syncRunId) await admin.from("sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_code: "NO_VALID_ROWS", error_message: "El lote no contiene filas válidas." }).eq("id", syncRunId);
    return NextResponse.json({ ok: false, error: "El lote no contiene filas válidas con SKU y nombre." }, { status: 400 });
  }

  let written = 0;
  for (let start = 0; start < normalized.length; start += BATCH_SIZE) {
    const batch = normalized.slice(start, start + BATCH_SIZE);
    const { data, error } = await admin.from("products").upsert(batch, { onConflict: "sku" }).select("id");
    if (error) {
      await admin.from("data_sources").update({ status: "error", updated_at: now }).eq("id", sourceId);
      if (syncRunId) await admin.from("sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), rows_written: written, error_code: "WRITE_FAILED", error_message: "Falló la escritura de un lote." }).eq("id", syncRunId);
      return NextResponse.json({ ok: false, error: "Falló la escritura del lote.", written }, { status: 500 });
    }
    written += data?.length ?? batch.length;
  }

  await admin.from("data_sources").update({ last_sync_at: now, status: "active", updated_at: now }).eq("id", sourceId);
  if (dataset && body?.watermark) await admin.from("datasets").update({ watermark_value: text(body.watermark, 250), updated_at: now }).eq("id", dataset.id);
  if (syncRunId) await admin.from("sync_runs").update({
    status: "succeeded",
    finished_at: new Date().toISOString(),
    rows_written: written,
    metadata: { source_id: sourceId, transport: "hmac_sha256", rejected: rows.length - normalized.length, watermark: text(body?.watermark, 250) },
  }).eq("id", syncRunId);

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
