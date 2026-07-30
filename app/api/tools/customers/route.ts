import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^(809|829|849)\d{7}$/.test(local) ? local : null;
}

export async function POST(request: Request) {
  if (!requireToolSecret(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { phone?: string; full_name?: string; email?: string; address?: string; sector?: string; source?: string };
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (!phone) return NextResponse.json({ ok: false, error: "Teléfono dominicano inválido" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const payload = { phone, full_name: body.full_name ?? null, email: body.email ?? null, address: body.address ?? null, sector: body.sector ?? null, source: body.source ?? "whatsapp", updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("customers").upsert(payload, { onConflict: "phone" }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customer: data });
}
