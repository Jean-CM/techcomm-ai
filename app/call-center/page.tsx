import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

const stateLabel: Record<string,string> = {
  received:"Recibida", validated:"Validada", contact_pending:"Por contactar", contacted:"Contactada", converted:"Convertida", closed:"Cerrada", cancelled:"Cancelada",
  created:"Creada", accepted:"Aceptada", location_pending:"Falta ubicación", scheduling:"Por agendar", scheduled:"Agendada", in_progress:"En servicio", completed:"Completada", declined:"Declinada", escalated:"Escalada",
};

export default async function CallCenterPage() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin.from("organization_memberships").select("role,status").eq("user_id", user.id).eq("organization_id", ORG_ID).maybeSingle();
  if (!membership || membership.status !== "active") redirect("/dashboard");

  const [{ data: purchases }, { data: requests }, { data: appointments }, { data: interactions }, { data: customers }] = await Promise.all([
    admin.from("cc_purchases").select("*").eq("organization_id", ORG_ID).order("created_at", { ascending:false }).limit(100),
    admin.from("cc_installation_requests").select("*").eq("organization_id", ORG_ID).order("created_at", { ascending:false }).limit(100),
    admin.from("cc_appointments").select("*").eq("organization_id", ORG_ID).order("starts_at", { ascending:false }).limit(100),
    admin.from("cc_interactions").select("*").eq("organization_id", ORG_ID).order("created_at", { ascending:false }).limit(100),
    admin.from("cc_customers").select("id,full_name,phone,province,municipality,sector").eq("organization_id", ORG_ID).limit(200),
  ]);

  const customerMap = new Map((customers || []).map(c => [c.id,c]));
  const requestMap = new Map((requests || []).map(r => [r.id,r]));
  const today = new Date().toISOString().slice(0,10);
  const contactsToday = (interactions || []).filter(i => String(i.started_at).slice(0,10) === today).length;
  const connectedToday = (interactions || []).filter(i => String(i.started_at).slice(0,10) === today && ["connected","completed"].includes(i.state)).length;
  const accepted = (requests || []).filter(r => r.acceptance_status === "accepted").length;
  const scheduled = (requests || []).filter(r => r.state === "scheduled").length;
  const pendingContact = (purchases || []).filter(p => p.state === "contact_pending").length;
  const conversion = (requests || []).length ? Math.round((accepted / (requests || []).length) * 100) : 0;

  return <main style={{minHeight:"100vh",background:"#071019",color:"#eef7fb",fontFamily:"Inter,system-ui,sans-serif"}}>
    <div style={{maxWidth:1440,margin:"0 auto",padding:"28px 24px 60px"}}>
      <header style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",marginBottom:28,flexWrap:"wrap"}}>
        <div><div style={{fontSize:11,fontWeight:900,letterSpacing:".18em",color:"#43c4ef"}}>TECHCOMM AI · INTEGRATION SANDBOX</div><h1 style={{margin:"6px 0 5px",fontSize:30}}>Call Center · Línea Blanca</h1><p style={{margin:0,color:"#8299aa",fontSize:14}}>Sprint 1 · Compra → contacto → instalación → ubicación → agenda → auditoría</p></div>
        <div style={{display:"flex",gap:8}}><Link href="/crm" style={ghost}>CRM actual</Link><Link href="/dashboard" style={ghost}>Inicio</Link></div>
      </header>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:18}}>
        <Kpi label="Por contactar" value={pendingContact} hint="Compras listas para gestión"/>
        <Kpi label="Interacciones hoy" value={contactsToday} hint={`${connectedToday} conectadas/completadas`}/>
        <Kpi label="Instalación aceptada" value={accepted} hint={`${conversion}% de solicitudes`}/>
        <Kpi label="Agendadas" value={scheduled} hint="Citas confirmadas"/>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.65fr) minmax(320px,.85fr)",gap:14,alignItems:"start"}}>
        <article style={card}>
          <div style={cardHead}><div><span style={eyebrow}>OPERACIÓN</span><h2 style={h2}>Solicitudes recientes</h2></div><span style={count}>{(requests || []).length}</span></div>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Cliente","Estado","Aceptación","Próximo paso","Creada"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
            {(requests || []).slice(0,12).map(r=>{const c=customerMap.get(r.customer_id);const next=r.state==="location_pending"?"Capturar dirección":r.state==="scheduling"?"Ofrecer agenda":r.state==="scheduled"?"Confirmación/recordatorio":r.state==="contact_pending"?"Contactar cliente":"Revisar caso";return <tr key={r.id}><td style={td}><strong>{c?.full_name||"Cliente"}</strong><div style={sub}>{c?.phone||""}</div></td><td style={td}><Status value={r.state}/></td><td style={td}>{r.acceptance_status}</td><td style={td}>{next}</td><td style={td}>{fmt(r.created_at)}</td></tr>})}
            {!(requests || []).length && <tr><td colSpan={5} style={{...td,textAlign:"center",padding:32,color:"#7890a1"}}>Aún no hay solicitudes. Ingresa una compra sandbox para iniciar el flujo.</td></tr>}
          </tbody></table></div>
        </article>

        <aside style={{display:"grid",gap:14}}>
          <article style={card}><span style={eyebrow}>SPRINT 1</span><h2 style={h2}>Contrato operativo</h2><div style={{display:"grid",gap:9,marginTop:14}}>{["1 · Compra recibida","2 · Contacto automático","3 · Aceptación instalación","4 · Dirección + 1 referencia","5 · Disponibilidad","6 · Cita confirmada","7 · Interacción auditada"].map((x,i)=><div key={x} style={{display:"flex",gap:9,alignItems:"center",fontSize:13,color:"#c8d8e2"}}><span style={{width:8,height:8,borderRadius:99,background:i<2?"#44d7a8":"#2d5268"}}/>{x}</div>)}</div></article>
          <article style={card}><span style={eyebrow}>INTEGRACIÓN</span><h2 style={h2}>Preparado para TI</h2><p style={{color:"#879dac",fontSize:13,lineHeight:1.55}}>Los agentes consumen contratos de Tools. Hoy apuntan al Sandbox; mañana el adaptador puede consultar APIs, BD, ERP o servidores del socio sin cambiar la conversación.</p><div style={{marginTop:12,padding:11,border:"1px solid #213847",borderRadius:10,background:"#09141c",fontFamily:"ui-monospace,monospace",fontSize:11,color:"#87cce6"}}>SandboxAdapter → TechcommAdapter</div></article>
        </aside>
      </section>

      <section style={{...card,marginTop:14}}><div style={cardHead}><div><span style={eyebrow}>TRAZABILIDAD</span><h2 style={h2}>Últimas interacciones</h2></div></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Canal","Estado","Cliente","Intención","Resultado","Hora"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{(interactions||[]).slice(0,10).map(i=>{const c=i.customer_id?customerMap.get(i.customer_id):null;return <tr key={i.id}><td style={td}>{i.channel}</td><td style={td}><Status value={i.state}/></td><td style={td}>{c?.full_name||"—"}</td><td style={td}>{i.intent||"—"}</td><td style={td}>{i.outcome||"—"}</td><td style={td}>{fmt(i.started_at)}</td></tr>})}{!(interactions||[]).length&&<tr><td colSpan={6} style={{...td,textAlign:"center",padding:26,color:"#7890a1"}}>Sin interacciones todavía.</td></tr>}</tbody></table></div></section>
    </div>
  </main>;
}

function Kpi({label,value,hint}:{label:string;value:number|string;hint:string}){return <article style={{...card,padding:16}}><div style={{color:"#8399aa",fontSize:11,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div><div style={{fontSize:28,fontWeight:900,margin:"5px 0 1px"}}>{value}</div><div style={{fontSize:11,color:"#6e8798"}}>{hint}</div></article>}
function Status({value}:{value:string}){return <span style={{display:"inline-block",padding:"5px 8px",borderRadius:999,border:"1px solid #294456",background:"#0b1922",fontSize:11,color:"#add4e5"}}>{stateLabel[value]||value}</span>}
function fmt(v:string){return new Date(v).toLocaleString("es-DO",{dateStyle:"short",timeStyle:"short"})}
const card:React.CSSProperties={background:"#0d1821",border:"1px solid #1d303d",borderRadius:14,padding:16,boxShadow:"0 14px 45px rgba(0,0,0,.16)"};
const cardHead:React.CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:12};
const eyebrow:React.CSSProperties={fontSize:10,fontWeight:900,letterSpacing:".15em",color:"#42bee9"};
const h2:React.CSSProperties={fontSize:17,margin:"4px 0 0"};
const count:React.CSSProperties={fontSize:11,color:"#8da5b5",border:"1px solid #29404f",borderRadius:999,padding:"5px 8px"};
const th:React.CSSProperties={textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".06em",color:"#668296",padding:"9px 10px",borderBottom:"1px solid #203340"};
const td:React.CSSProperties={padding:"11px 10px",borderBottom:"1px solid #172935",color:"#cbd9e1",verticalAlign:"top"};
const sub:React.CSSProperties={fontSize:11,color:"#708899",marginTop:2};
const ghost:React.CSSProperties={textDecoration:"none",color:"#bcd1dc",border:"1px solid #29404f",background:"#0c1720",borderRadius:10,padding:"9px 12px",fontSize:12};
