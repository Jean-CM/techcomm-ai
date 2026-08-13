import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const required = ["Marca","Modelo","Pieza","Descripción","Costo unitario","Precio venta","Descuento máximo","Stock total","Stock reservado","Categoría","Estado"];

function text(value: unknown) { return String(value ?? "").trim(); }
function number(value: unknown) {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9,.-]/g, "").replace(",", ".");
  return Number(cleaned) || 0;
}
function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok:false,error:"Selecciona un archivo XLSX o CSV." }, { status:400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type:"buffer" });
  const sheetName = workbook.SheetNames.includes("Catalogo") ? "Catalogo" : workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval:"" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const missing = required.filter((column) => !headers.includes(column));
  if (missing.length) return NextResponse.json({ ok:false,error:`Faltan columnas: ${missing.join(", ")}` }, { status:400 });

  const records = rows.filter((row) => text(row["Pieza"])).map((row) => {
    const brand = text(row["Marca"]);
    const model = text(row["Modelo"]);
    const piece = text(row["Pieza"]);
    const salePrice = number(row["Precio venta"]);
    let discount = number(row["Descuento máximo"]);
    if (discount > 1) discount /= 100;
    const stock = Math.max(0, Math.trunc(number(row["Stock total"])));
    const reserved = Math.max(0, Math.trunc(number(row["Stock reservado"])));
    return {
      sku: slug(`${brand}-${model}-${piece}`) || `IMP-${Date.now()}`,
      name: piece,
      piece_name: piece,
      item_type: text(row["Categoría"]).toLowerCase().includes("pieza") ? "pieza" : "producto",
      category: text(row["Categoría"]) || "General",
      brand: brand || null,
      model: model || null,
      description: text(row["Descripción"]) || null,
      unit_cost: number(row["Costo unitario"]),
      sale_price: salePrice,
      price: salePrice,
      max_discount_pct: Math.max(0, Math.min(discount, 1)),
      currency: "DOP",
      stock,
      reserved_stock: Math.min(reserved, stock),
      active: text(row["Estado"]).toLowerCase() !== "inactivo",
      updated_at: new Date().toISOString(),
    };
  });

  if (!records.length) return NextResponse.json({ ok:false,error:"El archivo no contiene filas válidas." }, { status:400 });
  const auth = await requireOrgRole(["owner","admin"]);
  if ("error" in auth) return auth.error;
  const supabase = auth.admin!;
  const { data, error } = await supabase.from("products").upsert(records, { onConflict:"sku" }).select("id,sku");
  if (error) return NextResponse.json({ ok:false,error:error.message }, { status:500 });
  return NextResponse.json({ ok:true, imported:data?.length ?? records.length, total:rows.length });
}
