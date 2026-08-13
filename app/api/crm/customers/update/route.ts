import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = { id?: string; full_name?: string; phone?: string; address?: string; sector?: string; email?: string };

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Payload;
  const fullName = body.full_name?.trim() || "";
  const phone = normalizePhone(body.phone || "");
  if (!body.id || !fullName) return NextResponse.json({ ok: false, error: "El cliente y el nombre son requeridos." }, { status: 400 });
  if (!/^(809|829|849)\d{7}$/.test(phone)) return NextResponse.json({ ok: false, error: "El teléfono debe tener 10 dígitos y comenzar con 809, 829 o 849." }, { status: 400 });

  const auth = await requireOrgRole(["owner","admin","manager","agent"]);
  if ("error" in auth) return auth.error;
  const supabase = auth.admin!;
  const { data, error } = await supabase.from("customers").update({
    full_name: fullName,
    phone,
    address: body.address?.trim() || null,
    sector: body.sector?.trim() || null,
    email: body.email?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customer: data });
}
