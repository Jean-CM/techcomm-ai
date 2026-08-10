import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: technician } = await admin.from("technicians").select("id").eq("user_id", user.id).maybeSingle();
  if (!technician) return NextResponse.json({ ok: false, error: "No tienes un perfil de técnico vinculado." }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ ok: true, products: [] });

  const { data: products, error } = await admin
    .from("products")
    .select("id,name,sku,price,stock")
    .ilike("name", `%${q}%`)
    .limit(10);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, products: products ?? [] });
}
