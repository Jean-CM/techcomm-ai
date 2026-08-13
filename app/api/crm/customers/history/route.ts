import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const customerId = new URL(request.url).searchParams.get("customer_id");
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "El cliente es requerido." }, { status: 400 });
  }

  const auth = await requireOrgRole(["owner","admin","manager","agent"]);
  if ("error" in auth) return auth.error;
  const supabase = auth.admin!;
  const [customerResult, appointmentsResult, ordersResult, conversationsResult, auditResult] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).single(),
    supabase.from("appointments").select("id,starts_at,status,technician_id,notes,address,created_at,updated_at").eq("customer_id", customerId).order("starts_at", { ascending: false }),
    supabase.from("work_orders").select("id,order_number,equipment,brand,model,issue,status,technician_id,created_at,updated_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("conversations").select("id,channel,intent,status,summary,started_at,ended_at").eq("customer_id", customerId).order("started_at", { ascending: false }),
    supabase.from("crm_audit_log").select("id,entity_type,entity_id,action,actor_name,actor_role,before_data,after_data,metadata,created_at").eq("entity_type", "customers").eq("entity_id", customerId).order("created_at", { ascending: false }).limit(100),
  ]);

  if (customerResult.error) {
    return NextResponse.json({ ok: false, error: customerResult.error.message }, { status: 404 });
  }

  const errors = [appointmentsResult.error, ordersResult.error, conversationsResult.error, auditResult.error]
    .map((error) => error?.message)
    .filter(Boolean);

  if (errors.length) {
    return NextResponse.json({ ok: false, error: errors.join(" · ") }, { status: 500 });
  }

  const timeline = [
    ...(appointmentsResult.data ?? []).map((item) => ({
      id: `appointment-${item.id}`,
      type: "appointment",
      title: "Cita",
      detail: `${item.notes || "Servicio"} · ${item.status}`,
      date: item.updated_at || item.created_at || item.starts_at,
      data: item,
    })),
    ...(ordersResult.data ?? []).map((item) => ({
      id: `order-${item.id}`,
      type: "order",
      title: item.order_number,
      detail: `${item.equipment || "Equipo"}: ${item.issue || "Sin detalle"} · ${item.status}`,
      date: item.updated_at || item.created_at,
      data: item,
    })),
    ...(conversationsResult.data ?? []).map((item) => ({
      id: `conversation-${item.id}`,
      type: "conversation",
      title: `Conversación ${item.channel}`,
      detail: item.summary || item.intent || "Sin resumen",
      date: item.started_at,
      data: item,
    })),
    ...(auditResult.data ?? []).map((item) => ({
      id: `audit-${item.id}`,
      type: "audit",
      title: item.action === "created" ? "Cliente creado" : "Datos del cliente actualizados",
      detail: `${item.actor_name || "Sistema"} · ${item.actor_role || "system"}`,
      date: item.created_at,
      data: item,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    ok: true,
    customer: customerResult.data,
    appointments: appointmentsResult.data ?? [],
    orders: ordersResult.data ?? [],
    conversations: conversationsResult.data ?? [],
    audit: auditResult.data ?? [],
    timeline,
  });
}
