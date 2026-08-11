import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;
type ItemType = "product" | "equipment" | "part" | "accessory";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;
const MAX_IMPORT_COLUMNS = 100;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function text(value: unknown) { return String(value ?? "").trim(); }
function num(value: unknown) {
  const parsed = Number(text(value).replace(/RD\$|\$|,/g, "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function pct(value: unknown) { const valueNumber = num(value); return valueNumber > 1 ? valueNumber / 100 : valueNumber; }
function bool(value: unknown) { return ["si", "sí", "yes", "true", "1", "x"].includes(text(value).toLowerCase()); }
function slug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36); }

function detectItemType(category: string, name: string): ItemType {
  const source = `${category} ${name}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/pieza|repuesto|pantalla|panel|tarjeta|motor|bateria|sensor|compresor|capacitor|correa|valvula|led|puerto|quemador|encendedor|aspa|seguro|flex|modulo|componente/.test(source)) return "part";
  if (/accesorio|cargador|cable|control remoto|protector|cover|carcasa|adaptador/.test(source)) return "accessory";
  if (/televisor|aire acondicionado|lavadora|lava y seca|estufa|abanico|nevera|refrigerador|telefono movil|smartphone|laptop|computadora/.test(source)) return "equipment";
  return "product";
}

function extractRows(sheet: XLSX.WorkSheet): Row[] {
  const reference = sheet["!ref"];
  if (!reference) return [];
  const range = XLSX.utils.decode_range(reference);
  const rowCount = range.e.r - range.s.r + 1;
  const columnCount = range.e.c - range.s.c + 1;
  if (rowCount > MAX_IMPORT_ROWS + 100) throw new Error(`El archivo supera el límite de ${MAX_IMPORT_ROWS} filas de datos.`);
  if (columnCount > MAX_IMPORT_COLUMNS) throw new Error(`El archivo supera el límite de ${MAX_IMPORT_COLUMNS} columnas.`);

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((cell) => ["pieza", "nombre", "producto"].includes(normalize(text(cell)))));
  if (headerIndex < 0) return [];
  const headers = (matrix[headerIndex] as unknown[]).map((cell) => normalize(text(cell)));
  const dataRows = matrix.slice(headerIndex + 1).filter((row) => Array.isArray(row) && row.some((cell) => text(cell)));
  if (dataRows.length > MAX_IMPORT_ROWS) throw new Error(`El archivo supera el límite de ${MAX_IMPORT_ROWS} filas de datos.`);
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, (row as unknown[])[index] ?? ""])));
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No se recibió el archivo." }, { status: 400 });

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return NextResponse.json({ ok: false, error: "Formato no permitido. Usa XLSX, XLS o CSV." }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ ok: false, error: "El archivo está vacío." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "El archivo supera el límite de 10 MB." }, { status: 413 });

  let workbook: XLSX.WorkBook;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    workbook = XLSX.read(buffer, { type: "buffer", dense: true });
  } catch {
    return NextResponse.json({ ok: false, error: "No fue posible leer el archivo. Verifica que no esté dañado." }, { status: 400 });
  }

  const sheetName = workbook.SheetNames.find((name) => normalize(name) === "catalogo") ?? workbook.SheetNames[0];
  if (!sheetName) return NextResponse.json({ ok: false, error: "El archivo no contiene hojas." }, { status: 400 });

  let rows: Row[];
  try { rows = extractRows(workbook.Sheets[sheetName]); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Archivo fuera de los límites permitidos." }, { status: 400 }); }
  if (!rows.length) return NextResponse.json({ ok: false, error: "No se encontró la fila de encabezados. Incluye una columna Pieza, Nombre o Producto." }, { status: 400 });

  const valid = rows.map((row, index) => {
    const brand = text(row.marca);
    const model = text(row.modelo);
    const name = text(row.pieza || row.nombre || row.producto);
    const category = text(row.categoria) || "General";
    const salePrice = num(row.precio_venta || row.precio);
    const maxDiscount = pct(row.descuento_maximo);
    const stock = Math.max(0, Math.floor(num(row.stock_total || row.stock)));
    const reserved = Math.max(0, Math.min(stock, Math.floor(num(row.stock_reservado || row.reservado))));
    const rawSku = text(row.sku || row.codigo || row.codigo_interno);
    const sku = rawSku || `IMP-${slug(brand || "GEN")}-${slug(model || "SIN-MODELO")}-${slug(name || String(index + 1))}`;
    return {
      sku,
      barcode: text(row.barcode || row.codigo_barra || row.codigo_barras) || null,
      name,
      piece_name: text(row.pieza) || name,
      description: text(row.descripcion) || null,
      category,
      subcategory: text(row.subcategoria) || null,
      brand: brand || null,
      model: model || null,
      supplier: text(row.proveedor) || null,
      warehouse_location: text(row.ubicacion || row.almacen || row.estante) || null,
      item_type: detectItemType(category, name),
      unit_cost: num(row.costo_unitario || row.costo),
      sale_price: salePrice,
      price: salePrice,
      max_discount_pct: Math.max(0, Math.min(1, maxDiscount)),
      currency: text(row.moneda) || "DOP",
      stock,
      reserved_stock: reserved,
      pending_stock: Math.max(0, Math.floor(num(row.stock_pendiente || row.pendiente || row.por_recibir))),
      min_stock: Math.max(0, Math.floor(num(row.stock_minimo || row.minimo))),
      serial_tracking: bool(row.control_serial || row.serial_imei),
      lot_tracking: bool(row.control_lote || row.lote),
      warranty_days: Math.max(0, Math.floor(num(row.garantia_dias))),
      active: !["inactivo", "descontinuado"].includes(text(row.estado).toLowerCase()),
      last_inventory_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }).filter((row) => row.name);

  if (!valid.length) return NextResponse.json({ ok: false, error: "No se encontraron filas válidas." }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const BATCH_SIZE = 500;
  let imported = 0;
  for (let start = 0; start < valid.length; start += BATCH_SIZE) {
    const batch = valid.slice(start, start + BATCH_SIZE);
    const { data, error } = await supabase.from("products").upsert(batch, { onConflict: "sku" }).select("id");
    if (error) return NextResponse.json({ ok: false, error: error.message, imported }, { status: 500 });
    imported += data?.length ?? batch.length;
  }

  return NextResponse.json({ ok: true, imported, rejected: rows.length - valid.length, sheet: sheetName });
}
