import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { signOut } from "../login/actions";

function stage(order: { technician_departed_at: string | null; technician_arrived_at: string | null; technician_visit_outcome: string | null }) {
  if (order.technician_visit_outcome) return "Visita cerrada";
  if (order.technician_arrived_at) return "En el cliente";
  if (order.technician_departed_at) return "En camino";
  return "Pendiente de salida";
}

export default async function TechnicianHomePage() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data: technician } = await admin
    .from("technicians")
    .select("id,full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!technician) {
    return <main style={{ minHeight:"100vh", background:"#0b1117", color:"#eef4f8", display:"grid", placeItems:"center", padding:24, fontFamily:"Inter,system-ui,sans-serif" }}><div style={{textAlign:"center",maxWidth:420}}><h1 style={{fontSize:22}}>Perfil técnico no vinculado</h1><p style={{color:"#8ca1b3"}}>Solicita a un administrador que vincule tu usuario con tu ficha de técnico.</p></div></main>;
  }

  const { data: orders } = await admin
    .from("work_orders")
    .select("id,order_number,status,equipment,brand,model,issue,technician_departed_at,technician_arrived_at,technician_visit_outcome,customer_id,appointment_id,created_at")
    .eq("technician_id", technician.id)
    .not("status", "in", "(completed,cancelled,devuelto_cliente)")
    .order("created_at", { ascending: false });

  const customerIds = [...new Set((orders ?? []).map(o => o.customer_id).filter(Boolean))] as string[];
  const appointmentIds = [...new Set((orders ?? []).map(o => o.appointment_id).filter(Boolean))] as string[];
  const [{ data: customers }, { data: appointments }] = await Promise.all([
    customerIds.length ? admin.from("customers").select("id,full_name,address,sector,province,municipality").in("id", customerIds) : Promise.resolve({data:[]}),
    appointmentIds.length ? admin.from("appointments").select("id,starts_at").in("id", appointmentIds) : Promise.resolve({data:[]}),
  ]);
  const customersById = new Map((customers ?? []).map(c => [c.id,c]));
  const appointmentsById = new Map((appointments ?? []).map(a => [a.id,a]));

  return (
    <main style={{ minHeight:"100vh", background:"#0b1117", color:"#edf5fa", fontFamily:"Inter,system-ui,sans-serif", padding:"18px 14px 32px" }}>
      <div style={{ maxWidth:680, margin:"0 auto" }}>
        <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:22}}>
          <div><div style={{fontSize:11,fontWeight:800,letterSpacing:".16em",color:"#42bde8"}}>TECHCOMM OPERATIONS</div><h1 style={{fontSize:24,margin:"5px 0 2px"}}>Mis órdenes</h1><p style={{margin:0,color:"#8197aa",fontSize:13}}>Hola, {technician.full_name.split(" ")[0]}. Aquí solo ves las órdenes asignadas a ti.</p></div>
          <form action={signOut}><button type="submit" style={{background:"#111a23",border:"1px solid #243543",color:"#9db0bf",borderRadius:10,padding:"9px 13px",cursor:"pointer"}}>Salir</button></form>
        </header>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><strong style={{fontSize:14}}>Pendientes</strong><span style={{fontSize:12,color:"#7e94a7",background:"#111a23",border:"1px solid #22313d",borderRadius:999,padding:"5px 9px"}}>{(orders ?? []).length} orden{(orders ?? []).length===1?"":"es"}</span></div>

        {(orders ?? []).length===0 ? <div style={{background:"#111a23",border:"1px solid #21303c",borderRadius:14,padding:"34px 20px",textAlign:"center"}}><div style={{fontSize:30,marginBottom:10}}>✓</div><strong>Todo al día</strong><p style={{color:"#8298aa",fontSize:13,marginBottom:0}}>No tienes órdenes pendientes por ahora.</p></div> : (orders ?? []).map(order => {
          const customer = order.customer_id ? customersById.get(order.customer_id) : null;
          const appointment = order.appointment_id ? appointmentsById.get(order.appointment_id) : null;
          const currentStage = stage(order);
          return <a key={order.id} href={`/tecnico/orden/${order.id}`} style={{display:"block",textDecoration:"none",color:"inherit",background:"#111a23",border:"1px solid #21313e",borderRadius:14,padding:16,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:10}}><div><span style={{fontSize:11,color:"#42bde8",fontWeight:800,letterSpacing:".08em"}}>{order.order_number}</span><h2 style={{fontSize:17,margin:"4px 0 0"}}>{[order.brand,order.model,order.equipment].filter(Boolean).join(" · ") || "Servicio técnico"}</h2></div><span style={{fontSize:11,fontWeight:700,color:currentStage==="En el cliente"?"#55d6a0":currentStage==="En camino"?"#f4bd59":"#9cb0bf",background:"#0d151c",border:"1px solid #263847",borderRadius:999,padding:"6px 9px",whiteSpace:"nowrap"}}>{currentStage}</span></div>
            <p style={{margin:"0 0 8px",fontSize:13,color:"#9db0bf"}}>{order.issue || "Sin detalle de falla"}</p>
            <div style={{fontSize:12,color:"#7890a3",lineHeight:1.55}}><div>{customer?.full_name || "Cliente sin nombre"}</div><div>{[customer?.address,customer?.sector,customer?.municipality,customer?.province].filter(Boolean).join(", ") || "Dirección pendiente"}</div>{appointment?.starts_at && <div style={{marginTop:3,color:"#a8bac8"}}>Cita: {new Date(appointment.starts_at).toLocaleString("es-DO",{dateStyle:"medium",timeStyle:"short"})}</div>}</div>
          </a>;
        })}
      </div>
    </main>
  );
}
