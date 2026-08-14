import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";

type Payload = {
  id?: string;
  full_name?: string;
  phone?: string;
  address?: string;
  sector?: string;
  province?: string;
  municipality?: string;
  address_reference_1?: string;
  address_reference_2?: string;
  latitude?: number | null;
  longitude?: number | null;
  email?: string;
};

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
  const address = body.address?.trim() || null;
  const sector = body.sector?.trim() || null;
  const province = body.province?.trim() || null;
  const municipality = body.municipality?.trim() || null;
  const reference1 = body.address_reference_1?.trim() || null;
  const reference2 = body.address_reference_2?.trim() || null;
  const latitude = Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null;
  const longitude = Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null;
  const locationPrecision = latitude != null && longitude != null
    ? "exact"
    : address ? "address"
    : sector ? "sector"
    : municipality ? "municipality"
    : province ? "province"
    : null;

  const { data, error } = await supabase.from("customers").update({
    full_name: fullName,
    phone,
    address,
    sector,
    province,
    municipality,
    address_reference_1: reference1,
    address_reference_2: reference2,
    latitude,
    longitude,
    location_precision: locationPrecision,
    location_updated_at: locationPrecision ? new Date().toISOString() : null,
    email: body.email?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", body.id).eq("organization_id", auth.organizationId).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customer: data });
}
