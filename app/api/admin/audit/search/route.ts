import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

async function requireOwnerOrAdmin() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return { error: NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 }) };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role)) {
    return { error: NextResponse.json({ ok: false, error: "Solo un owner o admin puede acceder a auditoría." }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(request: Request) {
  const auth = await requireOwnerOrAdmin();
  if (auth.error) return auth.error;
  const admin = auth.admin!;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const phone = searchParams.get("phone")?.trim();
  const nationalId = searchParams.get("national_id")?.trim();
  const customerName = searchParams.get("customer_name")?.trim();

  // If searching by cédula or name, resolve to matching phone numbers first,
  // since call_events is keyed by phone, not customer_id.
  let phoneFilter: string[] | null = null;
  if (nationalId || customerName) {
    let query = admin.from("customers").select("phone").eq("organization_id", DEFAULT_ORG_ID);
    if (nationalId) query = query.ilike("national_id", `%${nationalId}%`);
    if (customerName) query = query.ilike("full_name", `%${customerName}%`);
    const { data: matches } = await query;
    phoneFilter = (matches ?? []).map((m) => m.phone).filter(Boolean) as string[];
    if (phoneFilter.length === 0) {
      return NextResponse.json({ ok: true, results: [] });
    }
  }

  let eventsQuery = admin
    .from("call_events")
    .select("id,conversation_id,customer_phone,status,summary,audio_storage_path,audio_captured_at,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (dateFrom) eventsQuery = eventsQuery.gte("created_at", dateFrom);
  if (dateTo) eventsQuery = eventsQuery.lte("created_at", dateTo);
  if (phone) eventsQuery = eventsQuery.ilike("customer_phone", `%${phone}%`);
  if (phoneFilter) eventsQuery = eventsQuery.in("customer_phone", phoneFilter);

  const { data: events, error } = await eventsQuery;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Attach customer name for display where we can match by phone.
  const phones = [...new Set((events ?? []).map((e) => e.customer_phone).filter(Boolean))] as string[];
  const { data: customers } = phones.length
    ? await admin.from("customers").select("phone,full_name,national_id").in("phone", phones)
    : { data: [] };
  const byPhone = new Map((customers ?? []).map((c) => [c.phone, c]));

  const results = (events ?? []).map((e) => ({
    ...e,
    customer_name: e.customer_phone ? byPhone.get(e.customer_phone)?.full_name ?? null : null,
    national_id: e.customer_phone ? byPhone.get(e.customer_phone)?.national_id ?? null : null,
    has_audio: Boolean(e.audio_storage_path),
  }));

  return NextResponse.json({ ok: true, results });
}
