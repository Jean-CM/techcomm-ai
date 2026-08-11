import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

export async function GET() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!membership || membership.status !== "active") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const org = DEFAULT_ORG_ID;
  const [customers, products, appointments, orders, quotes, sales, technicians, conversations, reminders, inventorySummary] = await Promise.all([
    supabase.from("customers").select("id,full_name,phone,email,address,sector,source,created_at,updated_at").eq("organization_id", org).order("created_at", { ascending: false }).limit(500),
    // Inventory has its own scalable workspace. Overview needs only a small product lookup for recent sales.
    supabase.from("products").select("id,name").eq("organization_id", org).eq("active", true).order("updated_at", { ascending: false }).limit(1000),
    supabase.from("appointments").select("id,customer_id,technician_id,starts_at,ends_at,address,status,confirmation_status,technician_confirmation_status,technician_confirmation_at,requires_manual_assignment,notes,created_at,updated_at").eq("organization_id", org).order("starts_at", { ascending: true }).limit(500),
    supabase.from("work_orders").select("id,order_number,order_type,customer_id,appointment_id,technician_id,equipment,brand,model,issue,status,priority,source,visit_fee,visit_fee_creditable,visit_fee_applied_to_invoice,customer_repair_approved,customer_repair_approved_at,quote_id,created_at,updated_at").eq("organization_id", org).order("created_at", { ascending: false }).limit(500),
    supabase.from("quotes").select("id,quote_number,customer_id,work_order_id,status,total,created_at,expires_at").eq("organization_id", org).order("created_at", { ascending: false }).limit(250),
    supabase.from("sales").select("id,customer_id,product_id,quantity,unit_price,status,source,created_at").eq("organization_id", org).order("created_at", { ascending: false }).limit(250),
    supabase.from("technicians").select("id,full_name,phone,specialties,zones,status,active,whatsapp_enabled,notification_status,created_at").eq("organization_id", org).eq("active", true).order("full_name", { ascending: true }).limit(250),
    supabase.from("conversations").select("id,customer_id,channel,external_id,intent,status,summary,started_at,ended_at").eq("organization_id", org).order("started_at", { ascending: false }).limit(250),
    supabase.from("call_reminders").select("id,appointment_id,scheduled_for,status,attempts,customer_phone,customer_name,last_error").eq("organization_id", org).order("scheduled_for", { ascending: false }).limit(250),
    supabase.rpc("get_inventory_summary", { p_organization_id: org }).single(),
  ]);

  const errors = [customers, products, appointments, orders, quotes, sales, technicians, conversations, reminders, inventorySummary]
    .map((result) => result.error?.message)
    .filter(Boolean);

  if (errors.length) {
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  const customersById = new Map((customers.data ?? []).map((customer) => [customer.id, customer]));

  const conversationCards = (conversations.data ?? []).map((conversation) => ({
    id: conversation.id,
    conversation_id: conversation.external_id ?? conversation.id,
    customer_phone: conversation.customer_id ? customersById.get(conversation.customer_id)?.phone ?? null : null,
    status: conversation.status,
    summary: conversation.summary,
    metadata: {
      channel: conversation.channel,
      intent: conversation.intent,
    },
    created_at: conversation.started_at ?? conversation.ended_at ?? new Date(0).toISOString(),
  }));

  return NextResponse.json({
    ok: true,
    customers: customers.data ?? [],
    products: products.data ?? [],
    appointments: appointments.data ?? [],
    work_orders: orders.data ?? [],
    quotes: quotes.data ?? [],
    sales: sales.data ?? [],
    technicians: technicians.data ?? [],
    call_events: conversationCards,
    call_reminders: reminders.data ?? [],
    inventory_summary: inventorySummary.data ?? null,
  });
}
