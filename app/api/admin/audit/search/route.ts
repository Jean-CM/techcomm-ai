import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nestedString(record: Record<string, unknown>, key: string) {
  const direct = stringValue(record[key]);
  if (direct) return direct;
  const nested = asRecord(record[key]);
  return stringValue(nested.value) ?? stringValue(nested.text) ?? null;
}

function normalizeMotive(value: string | null) {
  if (!value) return null;
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

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
    .select("id,conversation_id,customer_phone,status,summary,order_id,audio_storage_path,audio_captured_at,metadata,analysis,created_at")
    .eq("event_type", "post_call_transcription")
    .order("created_at", { ascending: false })
    .limit(200);

  if (dateFrom) eventsQuery = eventsQuery.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) eventsQuery = eventsQuery.lte("created_at", `${dateTo}T23:59:59.999`);
  if (phone) eventsQuery = eventsQuery.ilike("customer_phone", `%${phone}%`);
  if (phoneFilter) eventsQuery = eventsQuery.in("customer_phone", phoneFilter);

  const { data: events, error } = await eventsQuery;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const phones = [...new Set((events ?? []).map((e) => e.customer_phone).filter(Boolean))] as string[];
  const orderIds = [...new Set((events ?? []).map((e) => e.order_id).filter(Boolean))] as string[];

  const [{ data: customers }, { data: orders }] = await Promise.all([
    phones.length
      ? admin.from("customers").select("phone,full_name,national_id").in("phone", phones)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? admin.from("work_orders").select("id,order_number").in("id", orderIds)
      : Promise.resolve({ data: [] }),
  ]);

  const byPhone = new Map((customers ?? []).map((c) => [c.phone, c]));
  const byOrderId = new Map((orders ?? []).map((o) => [o.id, o.order_number]));

  const results = (events ?? []).map((e) => {
    const metadata = asRecord(e.metadata);
    const analysis = asRecord(e.analysis);
    const collected = asRecord(analysis.data_collection_results);
    const sentimentRaw = analysis.sentiment_analysis;
    const sentimentRecord = asRecord(sentimentRaw);
    const duration = Number(metadata.call_duration_secs ?? metadata.duration_secs ?? 0);
    const successScore = Number(analysis.call_success_score ?? 0);
    const motive = normalizeMotive(
      nestedString(collected, "intent")
      ?? stringValue(metadata.intent)
      ?? nestedString(collected, "conversation_outcome")
    );

    return {
      id: e.id,
      conversation_id: e.conversation_id,
      customer_phone: e.customer_phone,
      customer_name: e.customer_phone ? byPhone.get(e.customer_phone)?.full_name ?? null : null,
      national_id: e.customer_phone ? byPhone.get(e.customer_phone)?.national_id ?? null : null,
      status: e.status,
      motive,
      summary: e.summary,
      order_number: e.order_id ? byOrderId.get(e.order_id) ?? null : null,
      duration_seconds: Number.isFinite(duration) ? duration : 0,
      termination_reason: stringValue(metadata.termination_reason),
      call_successful: typeof analysis.call_successful === "boolean" ? analysis.call_successful : null,
      call_success_score: Number.isFinite(successScore) ? successScore : null,
      sentiment: stringValue(sentimentRaw) ?? stringValue(sentimentRecord.sentiment) ?? stringValue(sentimentRecord.label),
      has_audio: Boolean(e.audio_storage_path),
      audio_captured_at: e.audio_captured_at,
      created_at: e.created_at,
    };
  });

  return NextResponse.json({ ok: true, results });
}
