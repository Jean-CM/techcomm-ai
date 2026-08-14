import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function safeEqualSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected || !received.startsWith("Bearer ")) return false;
  try {
    return timingSafeEqual(Buffer.from(received.slice(7)), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!safeEqualSecret(request.headers.get("authorization"), process.env.AGENT_TOOL_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    work_order_id?: string;
    address?: string;
    sector?: string;
    municipality?: string;
    province?: string;
    address_reference_1?: string;
    address_reference_2?: string;
    latitude?: number | null;
    longitude?: number | null;
    location_precision?: string;
  };

  const workOrderId = body.work_order_id?.trim();
  const address = body.address?.trim();
  const reference1 = body.address_reference_1?.trim();

  if (!workOrderId || !address || !reference1) {
    return NextResponse.json(
      { ok: false, error: "work_order_id, address and at least one address reference are required" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: order, error: orderError } = await admin
    .from("work_orders")
    .select("id,organization_id,customer_id")
    .eq("id", workOrderId)
    .maybeSingle();

  if (orderError) return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });
  if (!order?.customer_id) return NextResponse.json({ ok: false, error: "Work order or customer not found" }, { status: 404 });

  const latitude = body.latitude == null ? null : Number(body.latitude);
  const longitude = body.longitude == null ? null : Number(body.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  const { data: customer, error } = await admin
    .from("customers")
    .update({
      address,
      sector: body.sector?.trim() || null,
      municipality: body.municipality?.trim() || null,
      province: body.province?.trim() || null,
      address_reference_1: reference1,
      address_reference_2: body.address_reference_2?.trim() || null,
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null,
      location_precision: body.location_precision?.trim() || (hasCoordinates ? "exacta" : "direccion"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.customer_id)
    .eq("organization_id", order.organization_id)
    .select("id,address,sector,municipality,province,address_reference_1,address_reference_2,latitude,longitude,location_precision")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, registered: true, customer });
}
