import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";

const QUOTE_ROLES = ["owner", "admin", "manager", "agent"] as const;
const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 100;

type QuoteSummaryRow = {
  total?: number | string | null;
  draft?: number | string | null;
  pending_approval?: number | string | null;
  sent?: number | string | null;
  accepted?: number | string | null;
  rejected?: number | string | null;
  review_requested?: number | string | null;
  cancelled?: number | string | null;
  expired?: number | string | null;
  active_value?: number | string | null;
  accepted_value?: number | string | null;
};

function clean(value: string) {
  return value.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").slice(0, 100);
}

export async function GET(request: NextRequest) {
  const auth = await requireOrgRole(QUOTE_ROLES);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(10, Number(params.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const status = params.get("status") || "all";
  const q = clean(params.get("q") || "");
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const admin = auth.admin!;

  let query = admin.from("quotes")
    .select("id,quote_number,customer_id,work_order_id,status,subtotal,tax,total,discount_amount,discount_pct,installation_included,installation_amount,delivery_included,delivery_amount,approval_required,approved_at,accepted_by_customer,accepted_at,customer_name_snapshot,customer_phone_snapshot,customer_address_snapshot,notes,sent_at,sent_channel,customer_response,customer_responded_at,created_at,updated_at,expires_at", { count: "exact" })
    .eq("organization_id", auth.organizationId!);

  if (status !== "all") query = query.eq("status", status);
  if (q) {
    const like = `%${q}%`;
    query = query.or(`quote_number.ilike.${like},customer_name_snapshot.ilike.${like},customer_phone_snapshot.ilike.${like}`);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const [rows, summaryResult] = await Promise.all([
    query,
    admin.rpc("get_quote_summary", { p_organization_id: auth.organizationId! }).single(),
  ]);

  if (rows.error) return NextResponse.json({ ok: false, error: rows.error.message }, { status: 500 });
  if (summaryResult.error) return NextResponse.json({ ok: false, error: summaryResult.error.message }, { status: 500 });

  const raw = (summaryResult.data ?? {}) as QuoteSummaryRow;
  const summary = {
    total: Number(raw.total || 0),
    draft: Number(raw.draft || 0),
    pending_approval: Number(raw.pending_approval || 0),
    sent: Number(raw.sent || 0),
    accepted: Number(raw.accepted || 0),
    rejected: Number(raw.rejected || 0),
    review_requested: Number(raw.review_requested || 0),
    cancelled: Number(raw.cancelled || 0),
    expired: Number(raw.expired || 0),
    active_value: Number(raw.active_value || 0),
    accepted_value: Number(raw.accepted_value || 0),
  };

  const total = rows.count ?? 0;
  return NextResponse.json({
    ok: true,
    quotes: rows.data ?? [],
    summary,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
