import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  if (!requireToolSecret(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { query?: string; brand?: string; category?: string };
  const supabase = getSupabaseAdmin();
  let query = supabase.from("products").select("id,sku,name,category,brand,model,price,currency,stock,reserved_stock,active").eq("active", true).limit(10);
  if (body.query) query = query.ilike("name", `%${body.query}%`);
  if (body.brand) query = query.ilike("brand", `%${body.brand}%`);
  if (body.category) query = query.ilike("category", `%${body.category}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, products: (data ?? []).map((item) => ({ ...item, available_stock: Math.max(0, item.stock - item.reserved_stock) })) });
}
