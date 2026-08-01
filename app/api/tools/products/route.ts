import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";

type Payload = { query?: string; brand?: string; category?: string; model?: string };

function words(value?: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 8);
}

export async function POST(request: Request) {
  if (!requireToolSecret(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Payload;
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("products")
    .select("id,sku,name,piece_name,description,item_type,category,brand,model,sale_price,price,currency,stock,reserved_stock,installation_price,delivery_price,installation_includes_delivery,max_discount_pct,minimum_authorized_price")
    .eq("active", true)
    .limit(100);

  if (body.brand) query = query.ilike("brand", `%${body.brand.trim()}%`);
  if (body.category) query = query.ilike("category", `%${body.category.trim()}%`);
  if (body.model) query = query.ilike("model", `%${body.model.trim()}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const tokens = words(body.query);
  const ranked = (data ?? [])
    .map((item) => {
      const haystack = words([item.name, item.piece_name, item.description, item.category, item.brand, item.model].filter(Boolean).join(" "));
      const score = tokens.reduce((total, token) => total + (haystack.some((value) => value.includes(token) || token.includes(value)) ? 1 : 0), 0);
      return { item, score };
    })
    .filter(({ score }) => !tokens.length || score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ item }) => ({
      id: item.id,
      sku: item.sku,
      name: item.piece_name || item.name,
      description: item.description,
      item_type: item.item_type,
      category: item.category,
      brand: item.brand,
      model: item.model,
      price: Number(item.sale_price ?? item.price ?? 0),
      currency: item.currency,
      available: Math.max(0, Number(item.stock || 0) - Number(item.reserved_stock || 0)) > 0,
      installation_price: Number(item.installation_price || 0),
      delivery_price: Number(item.delivery_price || 0),
      installation_includes_delivery: Boolean(item.installation_includes_delivery),
      discount_available: Number(item.max_discount_pct || 0) > 0,
      minimum_authorized_price: Number(item.minimum_authorized_price || 0),
    }));

  return NextResponse.json({
    ok: true,
    found: ranked.length > 0,
    products: ranked,
    customer_message: ranked.length
      ? "Hay opciones disponibles. Presenta marca, modelo, características, precio sin instalación y costo de instalación o envío. No menciones cantidades exactas ni límites internos de descuento."
      : "No se encontró una coincidencia exacta. Pregunta por marca, tamaño, modelo o característica para refinar la búsqueda.",
  });
}
