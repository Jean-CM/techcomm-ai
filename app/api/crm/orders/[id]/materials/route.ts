import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("work_order_materials")
    .select("id,product_name,quantity,unit_price,is_additional_purchase,quote_id,created_at")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, materials: data ?? [] });
}
