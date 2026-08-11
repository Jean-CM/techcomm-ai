import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";

const QUOTE_ROLES = ["owner", "admin", "manager", "agent"] as const;
const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 100;

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

  const [rows, statusRows] = await Promise.all([
    query,
    admin.from("quotes")
      .select("status,total,approval_required,expires_at")
      .eq("organization_id", auth.organizationId!)
      .limit(5000),
  ]);

  if (rows.error) return NextResponse.json({ ok: false, error: rows.error.message }, { status: 500 });
  if (statusRows.error) return NextResponse.json({ ok: false, error: statusRows.error.message }, { status: 500 });

  const all = statusRows.data ?? [];
  const now = Date.now();
  const active = all.filter((row) => !["accepted", "rejected", "cancelled", "expired"].includes(String(row.status)) && !(row.expires_at && new Date(row.expires_at).getTime() <= now));
  const summary = {
    total: all.length,
    draft: all.filter((row) => row.status === "draft").length,
    pending_approval: all.filter((row) => row.status === "pending_approval").length,
    sent: all.filter((row) => row.status === "sent").length,
    accepted: all.filter((row) => row.status === "accepted").length,
    rejected: all.filter((row) => row.status === "rejected").length,
    active_value: active.reduce((sum, row) => sum + Number(row.total || 0), 0),
    accepted_value: all.filter((row) => row.status === "accepted").reduce((sum, row) => sum + Number(row.total || 0), 0),
  };

  const total = rows.count ?? 0;
  return NextResponse.json({
    ok: true,
    quotes: rows.data ?? [],
    summary,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
