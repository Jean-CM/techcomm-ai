import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function text(value: unknown) { return String(value ?? "").trim(); }
function num(value: unknown) {
  const parsed = Number(text(value).replace(/RD\$|\$|,/g, "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function pct(value: unknown) { const valueNumber = num(value); return valueNumber > 1 ? valueNumber / 100 : valueNumber; }
function slug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36); }

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No se recibió el archivo." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((name) => normalize(name) === "catalogo") ?? workbook.SheetNames[0];
  if (!sheetName) return NextResponse.json({ ok: false, error: "El archivo no contiene hojas." }, { status: 400 });

  const raw = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], { defval: "" });
  const rows = raw.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), value])));
  if (!rows.length) return NextResponse.json({ ok: false, error: "La hoja no contiene filas de catálogo." }, { status: 400 });

  const valid = rows.map((row, index) => {
    const brand = text(row.marca);
    const model = text(row.modelo);
    const name = text(row.pieza);
    const category = text(row.categoria) || "General";
    const salePrice = num(row.precio_venta);
    const maxDiscount = pct(row.descuento_maximo);
    const stock = Math.max(0, Math.floor(num(row.stock_total)));
    const reserved = Math.max(0, Math.min(stock, Math.floor(num(row.stock_reservado))));
    const sku = `IMP-${slug(brand || "GEN")}-${slug(model || "SIN-MODELO")}-${slug(name || String(index + 1))}`;
    return {
      sku,
      name,
      piece_name: name,
      description: text(row.descripcion) || null,
      category,
      brand: brand || null,
      model: model || null,
      item_type: /pieza|repuesto|pantalla|tarjeta|motor|bateria|sensor|compresor|capacitor|correa|valvula|led|puerto|quemador|encendedor|aspa/i.test(`${category} ${name}`) ? "piece" : "product",
      unit_cost: num(row.costo_unitario),
      sale_price: salePrice,
      price: salePrice,
      max_discount_pct: maxDiscount,
      currency: "DOP",
      stock,
      reserved_stock: reserved,
      active: text(row.estado).toLowerCase() !== "inactivo",
    };
  }).filter((row) => row.name);

  if (!valid.length) return NextResponse.json({ ok: false, error: "No se encontraron filas válidas. Verifica la columna Pieza." }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("products").upsert(valid, { onConflict: "sku" }).select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, imported: data?.length ?? valid.length, rejected: rows.length - valid.length, sheet: sheetName });
}
