import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [customers, products, appointments, orders, quotes, sales, technicians, callEvents] = await Promise.all([
    supabase.from("customers").select("id,full_name,phone,address,sector,source,created_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("products").select("id,sku,name,piece_name,description,item_type,category,brand,model,unit_cost,sale_price,price,max_discount_pct,minimum_authorized_price,currency,stock,reserved_stock,active,created_at").eq("active", true).order("created_at", { ascending: false }).limit(1000),
    supabase.from("appointments").select("id,customer_id,technician_id,starts_at,ends_at,address,status,confirmation_status,technician_confirmation_status,technician_confirmation_at,notes,created_at").order("starts_at", { ascending: true }).limit(250),
    supabase.from("work_orders").select("id,order_number,customer_id,appointment_id,technician_id,equipment,brand,model,issue,status,priority,source,visit_fee,visit_fee_creditable,visit_fee_applied_to_invoice,created_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("quotes").select("id,quote_number,customer_id,work_order_id,status,subtotal,tax,total,notes,created_at,expires_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("sales").select("id,customer_id,product_id,quantity,unit_price,status,source,created_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("technicians").select("id,full_name,phone,specialties,zones,status,active,whatsapp_enabled,notification_status,created_at").eq("active", true).order("full_name", { ascending: true }).limit(250),
    supabase.from("call_events").select("id,conversation_id,agent_id,event_type,status,customer_phone,order_id,summary,transcript,analysis,metadata,created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  const errors = [customers, products, appointments, orders, quotes, sales, technicians, callEvents].map((result) => result.error?.message).filter(Boolean);
  if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 500 });

  return NextResponse.json({ ok: true, customers: customers.data ?? [], products: products.data ?? [], appointments: appointments.data ?? [], work_orders: orders.data ?? [], quotes: quotes.data ?? [], sales: sales.data ?? [], technicians: technicians.data ?? [], call_events: callEvents.data ?? [] });
}
