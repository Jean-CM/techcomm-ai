import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";

export async function GET(request: Request) {
  const auth = await requireOrgRole(["owner", "admin", "manager", "agent"]);
  if ("error" in auth) return auth.error;

  const workOrderId = new URL(request.url).searchParams.get("work_order_id");
  if (!workOrderId) return NextResponse.json({ ok: false, error: "work_order_id es requerido" }, { status: 400 });

  const { data, error } = await auth.admin!
    .from("approval_calls")
    .select("id,agent_name,waiting_since,call_date,discount_offered,status_cc,channel,rejection_reason,created_at")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, calls: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireOrgRole(["owner", "admin", "manager", "agent"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    work_order_id?: string;
    agent_name?: string;
    call_date?: string;
    discount_offered?: number;
    status_cc?: string;
    channel?: string;
    rejection_reason?: string;
  };

  if (!body.work_order_id || !body.status_cc) {
    return NextResponse.json({ ok: false, error: "work_order_id y status_cc son requeridos" }, { status: 400 });
  }

  const { error } = await auth.admin!.from("approval_calls").insert({
    organization_id: auth.organizationId,
    work_order_id: body.work_order_id,
    agent_name: body.agent_name ?? auth.user!.email,
    call_date: body.call_date ?? new Date().toISOString(),
    discount_offered: body.discount_offered ?? null,
    status_cc: body.status_cc,
    channel: body.channel ?? null,
    rejection_reason: body.rejection_reason ?? null,
    recorded_by: auth.user!.id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (body.status_cc === "aprobado") {
    await auth.admin!.from("work_orders").update({ status: "approved" }).eq("id", body.work_order_id);
  } else if (body.status_cc === "rechazado") {
    await auth.admin!.from("work_orders").update({ status: "devuelto_cliente" }).eq("id", body.work_order_id);
  }

  return NextResponse.json({ ok: true });
}
