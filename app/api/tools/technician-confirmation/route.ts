import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";

type Payload = { appointment_id?: string; action?: "confirm" | "unavailable" };

export async function POST(request: Request) {
  if (!requireToolSecret(request)) return NextResponse.json({ ok:false,error:"Unauthorized" }, { status:401 });
  const body = await request.json().catch(() => ({})) as Payload;
  if (!body.appointment_id || !body.action) return NextResponse.json({ ok:false,error:"appointment_id and action are required" }, { status:400 });

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  if (body.action === "confirm") {
    const { error } = await supabase.from("appointments").update({
      technician_confirmation_status:"confirmed",
      technician_confirmation_at:now,
      requires_manual_assignment:false,
    }).eq("id", body.appointment_id);
    if (error) return NextResponse.json({ ok:false,error:error.message }, { status:500 });
    return NextResponse.json({ ok:true,status:"confirmed",message:"Asignación confirmada." });
  }

  const { error } = await supabase.from("appointments").update({
    technician_confirmation_status:"declined",
    technician_confirmation_at:now,
    requires_manual_assignment:true,
  }).eq("id", body.appointment_id);
  if (error) return NextResponse.json({ ok:false,error:error.message }, { status:500 });
  return NextResponse.json({ ok:true,status:"declined",message:"La orden volvió al CRM para reasignación." });
}
