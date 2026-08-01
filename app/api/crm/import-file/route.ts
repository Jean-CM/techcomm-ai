import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;
type ItemType = "product" | "equipment" | "part" | "accessory";

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

function detectItemType(category: string, name: string): ItemType {
  const source = `${category} ${name}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/pieza|repuesto|pantalla|panel|tarjeta|motor|bateria|sensor|compresor|capacitor|correa|valvula|led|puerto|quemador|encendedor|aspa|seguro|flex|modulo/.test(source)) return "part";
  if (/accesorio|cargador|cable|control remoto|protector|cover|carcasa|adaptador/.test(source)) return "accessory";
  if (/televisor|aire acondicionado|lavadora|lava y seca|estufa|abanico|nevera|refrigerador|telefono movil|smartphone|laptop|computadora/.test(source)) return "equipment";
  return "product";
}

function extractRows(sheet: XLSX.WorkSheet): Row[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((cell) => normalize(text(cell)) === "pieza"));
  if (headerIndex < 0) return [];
  const headers = (matrix[headerIndex] as unknown[]).map((cell) => normalize(text(cell)));
  return matrix.slice(headerIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => text(cell)))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, (row as unknown[])[index] ?? ""])));
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No se recibió el archivo." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((name) => normalize(name) === "catalogo") ?? workbook.SheetNames[0];
  if (!sheetName) return NextResponse.json({ ok: false, error: "El archivo no contiene hojas." }, { status: 400 });

  const rows = extractRows(workbook.Sheets[sheetName]);
  if (!rows.length) return NextResponse.json({ ok: false, error: "No se encontró la fila de encabezados. Verifica que exista la columna Pieza." }, { status: 400 });

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
      item_type: detectItemType(category, name),
      unit_cost: num(row.costo_unitario),
      sale_price: salePrice,
      price: salePrice,
      max_discount_pct: maxDiscount,
      currency: "DOP",
      stock,
      reserved_stock: reserved,
      active: !["inactivo", "descontinuado"].includes(text(row.estado).toLowerCase()),
    };
  }).filter((row) => row.name);

  if (!valid.length) return NextResponse.json({ ok: false, error: "No se encontraron filas válidas. Verifica la columna Pieza." }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("products").upsert(valid, { onConflict: "sku" }).select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, imported: data?.length ?? valid.length, rejected: rows.length - valid.length, sheet: sheetName });
}
