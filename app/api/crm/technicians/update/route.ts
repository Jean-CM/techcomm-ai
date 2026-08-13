import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = {
  id?: string;
  full_name?: string;
  phone?: string;
  specialties?: string[] | string;
  zones?: string[] | string;
  status?: "available" | "busy" | "unavailable";
  whatsapp_enabled?: boolean;
};

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function list(value?: string[] | string) {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Payload;
  const phone = normalizePhone(body.phone || "");
  if (!body.id || !body.full_name?.trim()) {
    return NextResponse.json({ ok: false, error: "El técnico y el nombre son requeridos." }, { status: 400 });
  }
  if (!/^(809|829|849)\d{7}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "El WhatsApp debe tener 10 dígitos y comenzar con 809, 829 o 849." }, { status: 400 });
  }
  if (!body.status || !["available", "busy", "unavailable"].includes(body.status)) {
    return NextResponse.json({ ok: false, error: "Estado de técnico inválido." }, { status: 400 });
  }

  const auth = await requireOrgRole(["owner","admin","manager"]);
  if ("error" in auth) return auth.error;
  const supabase = auth.admin!;
  const { data, error } = await supabase.from("technicians").update({
    full_name: body.full_name.trim(),
    phone,
    specialties: list(body.specialties),
    zones: list(body.zones),
    status: body.status,
    whatsapp_enabled: body.whatsapp_enabled !== false,
  }).eq("id", body.id).select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, technician: data });
}
