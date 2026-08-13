import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const ALLOWED_METHODS = new Set(["efectivo", "transferencia", "tarjeta", "otro"]);
const ALLOWED_CONCEPTS = new Set(["diagnostico", "flete", "mano_obra", "pieza", "otro"]);

export async function GET(request: Request) {
  const workOrderId = new URL(request.url).searchParams.get("work_order_id");
  if (!workOrderId) return NextResponse.json({ ok: false, error: "work_order_id es requerido" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("payments")
    .select("id,amount,method,concept,reference,created_at")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, payments: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    work_order_id?: string;
    amount?: number;
    method?: string;
    concept?: string;
    reference?: string;
  };

  if (!body.work_order_id || !body.amount || body.amount <= 0) {
    return NextResponse.json({ ok: false, error: "work_order_id y amount (mayor a 0) son requeridos" }, { status: 400 });
  }
  if (!body.method || !ALLOWED_METHODS.has(body.method)) {
    return NextResponse.json({ ok: false, error: "Método de pago inválido" }, { status: 400 });
  }
  if (!body.concept || !ALLOWED_CONCEPTS.has(body.concept)) {
    return NextResponse.json({ ok: false, error: "Concepto de pago inválido" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("payments").insert({
    organization_id: DEFAULT_ORG_ID,
    work_order_id: body.work_order_id,
    amount: body.amount,
    method: body.method,
    concept: body.concept,
    reference: body.reference ?? null,
    recorded_by: user.id,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
