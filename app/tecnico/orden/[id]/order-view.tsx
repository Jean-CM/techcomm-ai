"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type VisitOutcome = "completed" | "diagnosis_required" | "quote_or_part_required" | "customer_pending" | "not_applicable";

type OrderData = {
  order: {
    id:string; order_number:string; status:string; equipment:string; brand:string|null; model:string|null; issue:string;
    technician_departed_at:string|null; technician_arrived_at:string|null; technician_completed_at:string|null;
    technician_visit_outcome:string|null; technician_visit_notes:string|null;
  };
  customer: {
    full_name:string; address:string; sector:string|null; province:string|null; municipality:string|null;
    address_reference_1:string|null; address_reference_2:string|null; phone:string;
  } | null;
  appointment:{ starts_at:string } | null;
};

const OUTCOMES: {value:VisitOutcome; title:string; help:string}[] = [
  { value:"completed", title:"Servicio completado", help:"Lo solicitado quedó resuelto en la visita." },
  { value:"diagnosis_required", title:"Requiere diagnóstico", help:"Debe pasar a diagnóstico antes de continuar." },
  { value:"quote_or_part_required", title:"Requiere repuesto o cotización", help:"Hace falta pieza, producto o aprobación de costo." },
  { value:"customer_pending", title:"Pendiente por cliente", help:"El cliente debe decidir, coordinar o completar una condición." },
  { value:"not_applicable", title:"No aplica / solicitud diferente", help:"Lo encontrado no corresponde con la solicitud original o no aplica el servicio." },
];

export default function TechnicianOrderView({ orderId }:{ orderId:string }) {
  const [data,setData]=useState<OrderData|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState<string|null>(null);
  const [outcome,setOutcome]=useState<VisitOutcome|"">("");
  const [notes,setNotes]=useState("");
  const [photos,setPhotos]=useState<string[]>([]);
  const [acceptance,setAcceptance]=useState<"accepted"|"rejected"|"">("");
  const [acceptanceNotes,setAcceptanceNotes]=useState("");
  const [signature,setSignature]=useState<string|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawing=useRef(false);

  async function load(){
    try{
      const response=await fetch(`/api/tecnico/ordenes/${orderId}`,{cache:"no-store"});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"No fue posible cargar la orden.");
      setData(payload);
      setOutcome(payload.order?.technician_visit_outcome||"");
      setNotes(payload.order?.technician_visit_notes||"");
    }catch(err){setError(err instanceof Error?err.message:"No fue posible cargar la orden.");}
  }
  useEffect(()=>{void load();},[orderId]);

  async function basicAction(action:"salio"|"llego"){
    setError(null);setLoading(action);
    try{
      const response=await fetch(`/api/tecnico/ordenes/${orderId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"No fue posible actualizar la orden.");
      await load();
    }catch(err){setError(err instanceof Error?err.message:"No fue posible actualizar la orden.");}
    finally{setLoading(null);}
  }

  async function resolveVisit(){
    if(!outcome){setError("Selecciona el resultado de la visita.");return;}
    setError(null);setLoading("resolver");
    try{
      const body:Record<string,unknown>={action:"resolver_visita",visit_outcome:outcome,visit_notes:notes};
      if(outcome==="completed"){
        if(!acceptance)throw new Error("Indica si el cliente acepta el trabajo realizado.");
        if(!signature)throw new Error("Falta la firma del cliente.");
        if(!photos.length)throw new Error("Agrega al menos una foto de evidencia.");
        body.customer_acceptance=acceptance;
        body.customer_acceptance_notes=acceptanceNotes;
        body.signature_base64=signature;
        body.photo_base64_list=photos;
      }
      const response=await fetch(`/api/tecnico/ordenes/${orderId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"No fue posible cerrar la visita.");
      window.location.href="/tecnico";
    }catch(err){setError(err instanceof Error?err.message:"No fue posible cerrar la visita.");setLoading(null);}
  }

  function addPhotos(event:React.ChangeEvent<HTMLInputElement>){
    for(const file of Array.from(event.target.files||[])){
      const reader=new FileReader();
      reader.onload=()=>setPhotos(prev=>[...prev,String(reader.result)]);
      reader.readAsDataURL(file);
    }
    event.target.value="";
  }

  function pointer(event:React.PointerEvent<HTMLCanvasElement>){const rect=event.currentTarget.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function startDraw(event:React.PointerEvent<HTMLCanvasElement>){drawing.current=true;const ctx=canvasRef.current?.getContext("2d");const p=pointer(event);ctx?.beginPath();ctx?.moveTo(p.x,p.y);}
  function draw(event:React.PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;const ctx=canvasRef.current?.getContext("2d");if(!ctx)return;const p=pointer(event);ctx.strokeStyle="#111827";ctx.lineWidth=2.5;ctx.lineCap="round";ctx.lineTo(p.x,p.y);ctx.stroke();}
  function endDraw(){drawing.current=false;if(canvasRef.current)setSignature(canvasRef.current.toDataURL("image/png"));}
  function clearSignature(){const ctx=canvasRef.current?.getContext("2d");if(ctx&&canvasRef.current)ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height);setSignature(null);}

  if(error&&!data)return <Screen><p style={{color:"#ff8f8f"}}>{error}</p></Screen>;
  if(!data)return <Screen><p style={{color:"#8096a8"}}>Cargando orden...</p></Screen>;

  const {order,customer,appointment}=data;
  const arrived=Boolean(order.technician_arrived_at);
  const departed=Boolean(order.technician_departed_at);
  const location=[customer?.address,customer?.sector,customer?.municipality,customer?.province].filter(Boolean).join(", ");

  return <main style={{minHeight:"100vh",background:"#0b1117",color:"#edf5fa",fontFamily:"Inter,system-ui,sans-serif",padding:"16px 14px 36px"}}>
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <Link href="/tecnico" style={{display:"inline-block",color:"#8ea3b3",fontSize:13,textDecoration:"none",marginBottom:14}}>← Mis órdenes</Link>

      <section style={cardStyle}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div><div style={eyebrow}>{order.order_number}</div><h1 style={{fontSize:22,margin:"5px 0 6px"}}>{[order.brand,order.model,order.equipment].filter(Boolean).join(" · ")||"Servicio técnico"}</h1></div><span style={pill(arrived?"#4ad39a":departed?"#f0b84f":"#92a6b6")}>{arrived?"En el cliente":departed?"En camino":"Pendiente"}</span></div>
        <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #21303c",display:"grid",gap:12}}>
          <Info label="Cliente" value={`${customer?.full_name||"Sin nombre"}${customer?.phone?` · ${customer.phone}`:""}`}/>
          <Info label="Dirección" value={location||"Dirección pendiente"}/>
          {customer?.address_reference_1&&<Info label="Referencia 1" value={customer.address_reference_1}/>} 
          {customer?.address_reference_2&&<Info label="Referencia 2" value={customer.address_reference_2}/>} 
          <Info label="Solicitud / falla" value={order.issue||"Sin detalle"}/>
          {appointment?.starts_at&&<Info label="Cita" value={new Date(appointment.starts_at).toLocaleString("es-DO",{dateStyle:"medium",timeStyle:"short"})}/>} 
        </div>
      </section>

      <section style={{...cardStyle,marginTop:12}}>
        <div style={eyebrow}>ESTADO EN CAMPO</div><h2 style={{fontSize:17,margin:"5px 0 14px"}}>Actualiza dónde estás</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button disabled={departed||loading!==null} onClick={()=>basicAction("salio")} style={actionButton(departed)}>{departed?"✓ Salí hacia el cliente":loading==="salio"?"Registrando...":"Salí hacia el cliente"}</button>
          <button disabled={!departed||arrived||loading!==null} onClick={()=>basicAction("llego")} style={actionButton(arrived,!departed)}>{arrived?"✓ Estoy donde el cliente":loading==="llego"?"Registrando...":"Llegué donde el cliente"}</button>
        </div>
      </section>

      {arrived&&!order.technician_completed_at&&<section style={{...cardStyle,marginTop:12}}>
        <div style={eyebrow}>RESULTADO DE VISITA</div><h2 style={{fontSize:17,margin:"5px 0 4px"}}>¿Qué ocurrió con esta orden?</h2><p style={{fontSize:13,color:"#8197a8",margin:"0 0 14px"}}>Selecciona el resultado real. Esto define el siguiente paso de la orden.</p>
        <div style={{display:"grid",gap:8}}>{OUTCOMES.map(item=><button key={item.value} type="button" onClick={()=>setOutcome(item.value)} style={{textAlign:"left",padding:"12px 13px",borderRadius:11,border:outcome===item.value?"1px solid #21aee0":"1px solid #253642",background:outcome===item.value?"#0d2a38":"#0e171f",color:"#edf5fa",cursor:"pointer"}}><strong style={{display:"block",fontSize:13}}>{item.title}</strong><span style={{display:"block",fontSize:11,color:"#8298aa",marginTop:3}}>{item.help}</span></button>)}</div>

        <label style={{display:"block",fontSize:12,color:"#a6b8c6",marginTop:14}}>Nota técnica<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe brevemente lo encontrado o lo que debe hacerse después..." style={inputStyle}/></label>

        {outcome==="completed"&&<div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #21303c"}}>
          <h3 style={{fontSize:15,margin:"0 0 12px"}}>Evidencia de cierre</h3>
          <label style={{display:"block",fontSize:12,color:"#a6b8c6"}}>Foto del trabajo<input type="file" accept="image/*" capture="environment" multiple onChange={addPhotos} style={{display:"block",marginTop:7}}/></label>
          {!!photos.length&&<div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"10px 0"}}>{photos.map((photo,index)=><img key={index} src={photo} alt="Evidencia" style={{width:62,height:62,objectFit:"cover",borderRadius:8,border:"1px solid #2b3d4a"}}/>)}</div>}

          <div style={{marginTop:14}}><span style={{display:"block",fontSize:12,color:"#a6b8c6",marginBottom:7}}>Aceptación del cliente</span><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button type="button" onClick={()=>setAcceptance("accepted")} style={choiceButton(acceptance==="accepted")}>✓ Acepta</button><button type="button" onClick={()=>setAcceptance("rejected")} style={choiceButton(acceptance==="rejected")}>✕ No acepta</button></div></div>
          {acceptance==="rejected"&&<textarea value={acceptanceNotes} onChange={e=>setAcceptanceNotes(e.target.value)} placeholder="Motivo indicado por el cliente..." style={{...inputStyle,marginTop:9}}/>}

          <div style={{marginTop:14}}><span style={{display:"block",fontSize:12,color:"#a6b8c6",marginBottom:7}}>Firma del cliente</span><canvas ref={canvasRef} width={620} height={150} onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerLeave={endDraw} style={{width:"100%",height:150,background:"#f8fafc",borderRadius:10,touchAction:"none"}}/><button type="button" onClick={clearSignature} style={{marginTop:6,background:"transparent",border:0,color:"#7f95a6",fontSize:12,cursor:"pointer"}}>Borrar firma</button></div>
        </div>}

        {error&&<div style={{marginTop:12,padding:10,borderRadius:9,background:"#29191d",border:"1px solid #603039",color:"#ff9da9",fontSize:12}}>{error}</div>}
        <button disabled={loading!==null||!outcome} onClick={resolveVisit} style={{width:"100%",marginTop:16,padding:"14px 16px",borderRadius:11,border:0,background:outcome?"#21aee0":"#24323d",color:outcome?"#061017":"#708493",fontWeight:800,fontSize:14,cursor:outcome?"pointer":"default"}}>{loading==="resolver"?"Guardando...":"Guardar resultado y cerrar visita"}</button>
      </section>}
    </div>
  </main>;
}

function Screen({children}:{children:React.ReactNode}){return <main style={{minHeight:"100vh",background:"#0b1117",color:"#edf5fa",display:"grid",placeItems:"center",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}>{children}</main>}
function Info({label,value}:{label:string;value:string}){return <div><span style={{display:"block",fontSize:10,color:"#71889a",textTransform:"uppercase",letterSpacing:".08em",marginBottom:3}}>{label}</span><strong style={{display:"block",fontSize:13,fontWeight:600,lineHeight:1.45}}>{value}</strong></div>}
const cardStyle:React.CSSProperties={background:"#111a23",border:"1px solid #21313e",borderRadius:14,padding:16};
const eyebrow:React.CSSProperties={fontSize:10,fontWeight:800,letterSpacing:".15em",color:"#42bde8"};
const inputStyle:React.CSSProperties={width:"100%",minHeight:78,marginTop:7,padding:10,borderRadius:9,border:"1px solid #2a3c49",background:"#0b131a",color:"#edf5fa",fontFamily:"inherit",boxSizing:"border-box"};
function pill(color:string):React.CSSProperties{return{fontSize:10,fontWeight:800,color,background:"#0c141b",border:`1px solid ${color}55`,borderRadius:999,padding:"6px 9px",whiteSpace:"nowrap"}}
function actionButton(done:boolean,blocked=false):React.CSSProperties{return{padding:"13px 12px",borderRadius:10,border:`1px solid ${done?"#3f9f79":"#2a3d4b"}`,background:done?"#143126":blocked?"#10161c":"#0e1a23",color:done?"#69d7a6":blocked?"#53636f":"#d7e6ef",fontWeight:700,fontSize:12,cursor:blocked||done?"default":"pointer"}}
function choiceButton(active:boolean):React.CSSProperties{return{padding:11,borderRadius:9,border:active?"1px solid #32c58d":"1px solid #2a3c49",background:active?"#133127":"#0d161d",color:"#edf5fa",fontWeight:700,cursor:"pointer"}}
