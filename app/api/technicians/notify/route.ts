import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";

function whatsappId(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
}

async function isAuthorized(request: Request) {
  if (requireToolSecret(request)) return true;
  const supabase = await createClient().catch(() => null);
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { appointmentId } = await request.json().catch(() => ({})) as { appointmentId?: string };
  if (!appointmentId) return NextResponse.json({ ok:false,error:"appointmentId is required" }, { status:400 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const phoneNumberId = process.env.ELEVENLABS_WHATSAPP_PHONE_NUMBER_ID;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const templateName = process.env.TECHNICIAN_ASSIGNMENT_TEMPLATE_NAME ?? "techcomm_asignacion_tecnico";
  if (!apiKey || !phoneNumberId || !agentId) return NextResponse.json({ ok:false,error:"Missing ElevenLabs WhatsApp environment variables" }, { status:500 });

  const supabase = getSupabaseAdmin();
  const { data: appointment, error } = await supabase.from("appointments").select("id,customer_id,technician_id,starts_at,address,notes").eq("id", appointmentId).single();
  if (error || !appointment?.technician_id) return NextResponse.json({ ok:false,error:error?.message ?? "Appointment has no technician" }, { status:404 });

  const [{ data: technician }, { data: customer }, { data: order }] = await Promise.all([
    supabase.from("technicians").select("id,full_name,phone,whatsapp_enabled").eq("id", appointment.technician_id).single(),
    appointment.customer_id ? supabase.from("customers").select("full_name,phone").eq("id", appointment.customer_id).maybeSingle() : Promise.resolve({ data:null }),
    supabase.from("work_orders").select("order_number,equipment,issue").eq("appointment_id", appointment.id).limit(1).maybeSingle(),
  ]);

  if (!technician?.phone || !technician.whatsapp_enabled) return NextResponse.json({ ok:false,error:"Technician WhatsApp is not enabled" }, { status:400 });

  const parameters = [
    order?.order_number ?? appointment.id,
    customer?.full_name ?? "Cliente por confirmar",
    order?.equipment ?? appointment.notes ?? "Equipo por confirmar",
    order?.issue ?? appointment.notes ?? "Falla por confirmar",
    appointment.address ?? "Dirección por confirmar",
    new Date(appointment.starts_at).toLocaleString("es-DO", { timeZone:"America/Santo_Domingo" }),
  ];

  const response = await fetch("https://api.elevenlabs.io/v1/convai/whatsapp/outbound-message", {
    method:"POST",
    headers:{ "content-type":"application/json", "xi-api-key":apiKey },
    body:JSON.stringify({
      whatsapp_phone_number_id:phoneNumberId,
      whatsapp_user_id:whatsappId(technician.phone),
      template_name:templateName,
      template_language_code:"es",
      template_params:[{ type:"body", parameters:parameters.map((text) => ({ text })) }],
      agent_id:agentId,
      conversation_initiation_client_data:{ dynamic_variables:{ appointment_id:appointment.id, technician_id:technician.id } },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ ok:false,error:"WhatsApp notification failed",details:result }, { status:502 });

  const requestedAt = new Date();
  const expiresAt = new Date(requestedAt.getTime() + 30 * 60 * 1000);
  await supabase.from("appointments").update({
    technician_confirmation_status:"pending",
    technician_assignment_requested_at:requestedAt.toISOString(),
    technician_assignment_expires_at:expiresAt.toISOString(),
    technician_assignment_attempts:1,
    requires_manual_assignment:false,
  }).eq("id", appointment.id);

  return NextResponse.json({ ok:true, conversation_id:(result as { conversation_id?: string }).conversation_id, expires_at:expiresAt.toISOString() });
}
