import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CatalogRow = {
  marca?: string;
  modelo?: string;
  pieza?: string;
  descripcion?: string;
  costo_unitario?: number | string;
  precio_venta?: number | string;
  descuento_maximo?: number | string;
  precio_minimo_autorizado?: number | string;
  stock_total?: number | string;
  stock_reservado?: number | string;
  stock_disponible?: number | string;
  categoria?: string;
  estado?: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function num(value: unknown) {
  const normalized = text(value).replace(/RD\$|\$|,/g, "").replace(/%$/, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentage(value: unknown) {
  const raw = num(value);
  return raw > 1 ? raw / 100 : raw;
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { rows?: CatalogRow[]; source?: string };
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) return NextResponse.json({ ok: false, error: "No se recibieron filas para importar." }, { status: 400 });
  if (rows.length > 2000) return NextResponse.json({ ok: false, error: "El archivo supera el límite de 2,000 filas por carga." }, { status: 400 });

  const valid = rows.map((row, index) => {
    const brand = text(row.marca);
    const model = text(row.modelo);
    const name = text(row.pieza);
    const salePrice = num(row.precio_venta);
    const maxDiscount = percentage(row.descuento_maximo);
    const minimumPrice = num(row.precio_minimo_autorizado) || salePrice * (1 - maxDiscount);
    const stock = Math.max(0, Math.floor(num(row.stock_total)));
    const reserved = Math.max(0, Math.min(stock, Math.floor(num(row.stock_reservado))));
    const sku = `IMP-${slug(brand || "GEN")}-${slug(model || name || String(index + 1))}-${index + 1}`;
    return {
      sku,
      name,
      category: text(row.categoria) || "General",
      brand: brand || null,
      model: model || null,
      item_type: "catalog",
      piece_name: name || null,
      description: text(row.descripcion) || null,
      unit_cost: num(row.costo_unitario),
      sale_price: salePrice,
      price: salePrice,
      max_discount_pct: maxDiscount,
      minimum_authorized_price: minimumPrice,
      currency: "DOP",
      stock,
      reserved_stock: reserved,
      active: text(row.estado).toLowerCase() !== "inactivo",
    };
  }).filter((row) => row.name);

  if (!valid.length) return NextResponse.json({ ok: false, error: "Ninguna fila contiene el campo Pieza." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("products").upsert(valid, { onConflict: "sku" }).select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, imported: data?.length ?? valid.length, rejected: rows.length - valid.length, source: payload.source ?? "archivo" });
}
