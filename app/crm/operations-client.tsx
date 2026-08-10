"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./operations-client.module.css";
import { signOut } from "../login/actions";

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;

type Role = "super_admin" | "admin" | "secretary" | "supervisor" | "technician";
type Permission = "edit_customer" | "edit_technician" | "edit_product" | "reschedule" | "reassign" | "update_order" | "manual_management" | "view_financial";

type Customer = { id:string; full_name?:string|null; phone:string; email?:string|null; address?:string|null; sector?:string|null; source?:string|null; created_at?:string; updated_at?:string };
type Product = { id:string; sku?:string|null; name:string; piece_name?:string|null; description?:string|null; item_type?:string|null; category?:string|null; brand?:string|null; model?:string|null; unit_cost?:number|null; sale_price?:number|null; price?:number|null; max_discount_pct?:number|null; minimum_authorized_price?:number|null; installation_price?:number|null; delivery_price?:number|null; installation_includes_delivery?:boolean|null; stock:number; reserved_stock:number; active?:boolean };
type Technician = { id:string; full_name:string; phone?:string|null; specialties?:string[]|null; zones?:string[]|null; status:string; whatsapp_enabled?:boolean };
type Appointment = { id:string; customer_id?:string|null; technician_id?:string|null; starts_at:string; ends_at?:string|null; address?:string|null; status:string; confirmation_status?:string|null; technician_confirmation_status?:string|null; requires_manual_assignment?:boolean; notes?:string|null; created_at?:string; updated_at?:string };
type WorkOrder = { id:string; order_number:string; order_type?:string|null; customer_id?:string|null; appointment_id?:string|null; technician_id?:string|null; equipment?:string|null; brand?:string|null; model?:string|null; issue?:string|null; status:string; priority?:string|null; source?:string|null; created_at?:string; updated_at?:string };
type Quote = { id:string; quote_number:string; customer_id?:string|null; status:string; total?:number|null; created_at?:string };
type Sale = { id:string; customer_id?:string|null; quantity:number; unit_price:number; status:string; created_at?:string };
type CallEvent = { id:string; conversation_id:string; customer_phone?:string|null; status?:string|null; summary?:string|null; transcript?:unknown; analysis?:unknown; metadata?:Record<string,unknown>|null; created_at:string };
type CallReminder = { id:string; appointment_id:string; scheduled_for:string; status:string; attempts:number; customer_name?:string|null; customer_phone?:string|null; last_error?:string|null };
type Overview = { ok:boolean; customers:Customer[]; products:Product[]; technicians:Technician[]; appointments:Appointment[]; work_orders:WorkOrder[]; quotes:Quote[]; sales:Sale[]; call_events:CallEvent[]; call_reminders:CallReminder[] };
type DetailMessage = { id:string; role:string; content:string; created_at:string };
type TimelineItem = { id:string; type:string; title:string; detail:string; date:string };

type ModalState =
  | { kind:"customer"; item:Customer }
  | { kind:"technician"; item:Technician }
  | { kind:"product"; item:Product }
  | { kind:"appointment"; item:Appointment }
  | { kind:"order"; item:WorkOrder }
  | { kind:"conversation"; item:CallEvent }
  | { kind:"history"; item:Customer }
  | { kind:"manual" }
  | null;

const EMPTY: Overview = { ok:true, customers:[], products:[], technicians:[], appointments:[], work_orders:[], quotes:[], sales:[], call_events:[], call_reminders:[] };

const ROLE_META: Record<Role,{label:string;description:string;menus:string[];permissions:Permission[]}> = {
  super_admin:{ label:"Super Admin", description:"Control total del CRM, operación y configuración.", menus:["Dashboard","Conversaciones","Clientes","Agenda y Órdenes","Técnicos","Ventas","Inventario","Cotizaciones"], permissions:["edit_customer","edit_technician","edit_product","reschedule","reassign","update_order","manual_management","view_financial"] },
  admin:{ label:"Administrador", description:"Administración operativa completa sin configuración sensible.", menus:["Dashboard","Conversaciones","Clientes","Agenda y Órdenes","Técnicos","Ventas","Inventario","Cotizaciones"], permissions:["edit_customer","edit_technician","edit_product","reschedule","reassign","update_order","manual_management","view_financial"] },
  secretary:{ label:"Secretaría", description:"Atención de clientes, agenda, reprogramaciones y gestiones presenciales.", menus:["Dashboard","Conversaciones","Clientes","Agenda y Órdenes","Cotizaciones"], permissions:["edit_customer","reschedule","manual_management"] },
  supervisor:{ label:"Supervisor técnico", description:"Citas, técnicos, órdenes, pendientes y reasignaciones.", menus:["Dashboard","Conversaciones","Clientes","Agenda y Órdenes","Técnicos"], permissions:["edit_technician","reschedule","reassign","update_order"] },
  technician:{ label:"Técnico (vista previa)", description:"Así se ve la operación desde el punto de vista de un técnico — solo su agenda y sus órdenes. Los técnicos reales usan su propio portal en /tecnico, no el CRM.", menus:["Dashboard","Agenda y Órdenes"], permissions:[] },
};

const STATUS_LABELS: Record<string,string> = {
  available:"Disponible", busy:"Ocupado", unavailable:"No disponible", new:"Nueva", scheduled:"Programada", confirmed:"Confirmada", rescheduled:"Reprogramada", assigned:"Asignada", in_progress:"En proceso", pending_customer:"Pendiente cliente", approved:"Aprobada", on_hold:"En espera", completed:"Completada", cancelled:"Cancelada", pending:"Pendiente", sent:"Enviada", failed:"Fallida", draft:"Borrador", accepted:"Aceptada", done:"Completada",
};

function money(value?:number|null){ return value==null?"Por confirmar":new Intl.NumberFormat("es-DO",{style:"currency",currency:"DOP",maximumFractionDigits:2}).format(value); }
function cleanPhone(value?:string|null){ return String(value||"").replace(/\D/g,"").replace(/^1(?=8(?:09|29|49))/ ,""); }
function statusLabel(value?:string|null){ return value?STATUS_LABELS[value]||value:"Pendiente"; }
function localDate(value?:string|null){ return value?new Date(value).toLocaleString("es-DO",{dateStyle:"medium",timeStyle:"short"}):"Sin fecha"; }
function toLocalInput(value?:string|null){ if(!value)return ""; const date=new Date(value); const offset=date.getTimezoneOffset(); return new Date(date.getTime()-offset*60000).toISOString().slice(0,16); }
function channel(event:CallEvent){ const raw=String(event.metadata?.channel??event.metadata?.source??"").toLowerCase(); return raw.includes("whatsapp")?"WhatsApp":"Llamada"; }
function badgeClass(value?:string|null){ if(["completed","confirmed","accepted","available","sent","done","approved"].includes(String(value)))return `${styles.badge} ${styles.badgeOk}`; if(["cancelled","failed","unavailable"].includes(String(value)))return `${styles.badge} ${styles.badgeBad}`; if(["pending","busy","on_hold","pending_customer","rescheduled","scheduled","assigned","new","in_progress","draft"].includes(String(value)))return `${styles.badge} ${styles.badgeWarn}`; return styles.badge; }

export default function OperationsClient(){
  const [data,setData]=useState<Overview>(EMPTY);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [active,setActive]=useState("Dashboard");
  const [role,setRole]=useState<Role>("super_admin");
  const [modal,setModal]=useState<ModalState>(null);
  const [conversationDetail,setConversationDetail]=useState<{messages:DetailMessage[];event?:CallEvent;audio_url?:string|null}|null>(null);
  const [history,setHistory]=useState<TimelineItem[]>([]);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [secondaryFilter,setSecondaryFilter]=useState("all");
  const [orderTypeFilter,setOrderTypeFilter]=useState("all");
  const [dateFilter,setDateFilter]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch("/api/crm/overview",{cache:"no-store"});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||payload.errors?.join(" · ")||"No fue posible cargar el CRM.");
      setData({...EMPTY,...payload});
    }catch(error){ setMessage(error instanceof Error?error.message:"Error al cargar el CRM."); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ void load(); },[load]);
  useEffect(()=>{
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void signOut(); }, INACTIVITY_LIMIT_MS);
    };
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  },[]);
  useEffect(()=>{ if(!ROLE_META[role].menus.includes(active))setActive(ROLE_META[role].menus[0]); },[role,active]);
  useEffect(()=>{ setSearch("");setStatusFilter("all");setSecondaryFilter("all");setDateFilter("");setOrderTypeFilter("all"); },[active]);

  const can=(permission:Permission)=>ROLE_META[role].permissions.includes(permission);
  const customersById=useMemo(()=>new Map(data.customers.map(item=>[item.id,item])),[data.customers]);
  const customersByPhone=useMemo(()=>new Map(data.customers.map(item=>[cleanPhone(item.phone),item])),[data.customers]);
  const techniciansById=useMemo(()=>new Map(data.technicians.map(item=>[item.id,item])),[data.technicians]);
  const appointmentsById=useMemo(()=>new Map(data.appointments.map(item=>[item.id,item])),[data.appointments]);
  const today=new Date().toISOString().slice(0,10);

  const conversations=useMemo(()=>data.call_events.filter(item=>{
    const customer=customersByPhone.get(cleanPhone(item.customer_phone));
    const haystack=[customer?.full_name,item.customer_phone,item.summary,channel(item)].filter(Boolean).join(" ").toLowerCase();
    return (!search||haystack.includes(search.toLowerCase()))&&(statusFilter==="all"||channel(item)===statusFilter);
  }),[data.call_events,customersByPhone,search,statusFilter]);

  const customers=useMemo(()=>data.customers.filter(item=>{
    const haystack=[item.full_name,item.phone,item.email,item.address,item.sector,item.source].filter(Boolean).join(" ").toLowerCase();
    return (!search||haystack.includes(search.toLowerCase()))&&(statusFilter==="all"||item.source===statusFilter);
  }),[data.customers,search,statusFilter]);

  const appointments=useMemo(()=>data.appointments.filter(item=>{
    const customer=customersById.get(item.customer_id||"");
    const tech=techniciansById.get(item.technician_id||"");
    const haystack=[customer?.full_name,customer?.phone,item.notes,item.address,tech?.full_name].filter(Boolean).join(" ").toLowerCase();
    const sameDate=!dateFilter||item.starts_at.slice(0,10)===dateFilter;
    return (!search||haystack.includes(search.toLowerCase()))&&(statusFilter==="all"||item.status===statusFilter)&&(secondaryFilter==="all"||String(item.technician_id||"unassigned")===secondaryFilter)&&sameDate;
  }),[data.appointments,customersById,techniciansById,search,statusFilter,secondaryFilter,dateFilter]);

  const technicians=useMemo(()=>data.technicians.filter(item=>{
    const haystack=[item.full_name,item.phone,(item.specialties||[]).join(" "),(item.zones||[]).join(" ")].join(" ").toLowerCase();
    return (!search||haystack.includes(search.toLowerCase()))&&(statusFilter==="all"||item.status===statusFilter);
  }),[data.technicians,search,statusFilter]);

  const orders=useMemo(()=>data.work_orders.filter(item=>{
    const customer=customersById.get(item.customer_id||"");
    const tech=techniciansById.get(item.technician_id||"");
    const appt=appointmentsById.get(item.appointment_id||"");
    const haystack=[item.order_number,customer?.full_name,item.equipment,item.brand,item.model,item.issue,tech?.full_name,appt?.address,customer?.address].filter(Boolean).join(" ").toLowerCase();
    const sameDate=!dateFilter||(appt?.starts_at?appt.starts_at.slice(0,10)===dateFilter:false);
    return (!search||haystack.includes(search.toLowerCase()))&&(statusFilter==="all"||item.status===statusFilter)&&(secondaryFilter==="all"||String(item.technician_id||"unassigned")===secondaryFilter)&&(orderTypeFilter==="all"||(item.order_type||"reparacion_instalacion")===orderTypeFilter)&&sameDate;
  }),[data.work_orders,customersById,techniciansById,appointmentsById,search,statusFilter,secondaryFilter,orderTypeFilter,dateFilter]);

  const products=useMemo(()=>data.products.filter(item=>{
    const haystack=[item.sku,item.name,item.piece_name,item.description,item.category,item.brand,item.model].filter(Boolean).join(" ").toLowerCase();
    return (!search||haystack.includes(search.toLowerCase()))&&(statusFilter==="all"||item.item_type===statusFilter);
  }),[data.products,search,statusFilter]);

  async function post(url:string,body:Record<string,unknown>){
    const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,actor_name:"Jean Carlos Mateo",actor_role:role})});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error||"No fue posible completar la operación.");
    return payload;
  }

  async function saveModal(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); if(!modal)return;
    const form=new FormData(event.currentTarget); setMessage("Guardando cambios...");
    try{
      if(modal.kind==="customer"){
        await post("/api/crm/customers/update",{id:modal.item.id,full_name:form.get("full_name"),phone:form.get("phone"),email:form.get("email"),address:form.get("address"),sector:form.get("sector")});
      }else if(modal.kind==="technician"){
        await post("/api/crm/technicians/update",{id:modal.item.id,full_name:form.get("full_name"),phone:form.get("phone"),specialties:form.get("specialties"),zones:form.get("zones"),status:form.get("status"),whatsapp_enabled:form.get("whatsapp_enabled")==="on"});
      }else if(modal.kind==="product"){
        await post("/api/crm/products/update",{id:modal.item.id,sku:form.get("sku"),name:form.get("name"),piece_name:form.get("piece_name"),description:form.get("description"),item_type:form.get("item_type"),category:form.get("category"),brand:form.get("brand"),model:form.get("model"),unit_cost:Number(form.get("unit_cost")||0),sale_price:Number(form.get("sale_price")||0),max_discount_pct:Number(form.get("max_discount_pct")||0)/100,stock:Number(form.get("stock")||0),reserved_stock:Number(form.get("reserved_stock")||0),installation_price:Number(form.get("installation_price")||0),delivery_price:Number(form.get("delivery_price")||0),installation_includes_delivery:form.get("installation_includes_delivery")==="on"});
      }else if(modal.kind==="appointment"){
        await post("/api/crm/appointments/update",{id:modal.item.id,starts_at:new Date(String(form.get("starts_at"))).toISOString(),technician_id:form.get("technician_id")||null,status:form.get("status")});
      }else if(modal.kind==="order"){
        await post("/api/crm/orders/update",{id:modal.item.id,technician_id:form.get("technician_id")||null,status:form.get("status"),priority:form.get("priority")});
      }else if(modal.kind==="manual"){
        const action=String(form.get("action"));
        await post("/api/crm/manual-management",{action,customer_id:form.get("customer_id")||undefined,customer_name:form.get("customer_name"),phone:form.get("phone"),email:form.get("email"),address:form.get("address"),sector:form.get("sector"),technician_id:form.get("technician_id")||null,starts_at:form.get("starts_at")?new Date(String(form.get("starts_at"))).toISOString():undefined,notes:form.get("notes"),equipment:form.get("equipment"),brand:form.get("brand"),model:form.get("model"),issue:form.get("issue"),priority:form.get("priority")});
      }
      setModal(null); setMessage("Cambios guardados correctamente."); await load();
    }catch(error){ setMessage(error instanceof Error?error.message:"No fue posible guardar."); }
  }

  async function openConversation(item:CallEvent){
    setModal({kind:"conversation",item}); setConversationDetail(null);
    const response=await fetch(`/api/crm/conversations/${item.id}`,{cache:"no-store"});
    const payload=await response.json();
    if(response.ok)setConversationDetail({messages:payload.messages||[],event:payload.event,audio_url:payload.audio_url});
    else setMessage(payload.error||"No fue posible abrir la conversación.");
  }

  async function openHistory(item:Customer){
    setModal({kind:"history",item}); setHistory([]);
    const response=await fetch(`/api/crm/customers/history?customer_id=${item.id}`,{cache:"no-store"});
    const payload=await response.json();
    if(response.ok)setHistory(payload.timeline||[]);
    else setMessage(payload.error||"No fue posible cargar el historial.");
  }

  const filteredEmpty=(text:string)=><div className={styles.empty}>{text}</div>;
  const actionButton=(label:string,onClick:()=>void,kind:"secondary"|"ghost"="secondary")=><button type="button" className={kind==="ghost"?styles.ghost:styles.secondary} onClick={onClick}>{label}</button>;

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><h2>Techcomm <span>Operations</span></h2><p>Centro de operaciones</p></div>
      <div className={styles.roleCard}><small>Vista de perfil</small><select value={role} onChange={event=>setRole(event.target.value as Role)}>{Object.entries(ROLE_META).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></div>
      <nav className={styles.nav}>{ROLE_META[role].menus.map(item=><button key={item} className={active===item?styles.active:""} onClick={()=>setActive(item)}>{item}</button>)}</nav>
      <button type="button" className={styles.ghost} style={{marginTop:"auto"}} onClick={()=>void signOut()}>Cerrar sesión</button>
      <Link className={styles.ghost} href="/admin" style={{textAlign:"center"}}>Super Admin</Link>
      <div className={styles.sidebarFoot}><span className={styles.dot}/>Supabase conectado<br/><span className={styles.dot}/>WhatsApp y voz activos<br/><span className={styles.dot}/>Sesión se cierra sola tras 5 min inactivo</div>
    </aside>

    <section className={styles.content}>
      <header className={styles.header}><div><small>OPERACIÓN EN TIEMPO REAL</small><h1>{active}</h1></div><div className={styles.headerActions}>{can("manual_management")&&<button className={styles.button} onClick={()=>setModal({kind:"manual"})}>+ Nueva gestión</button>}<button className={styles.secondary} onClick={()=>void load()}>Actualizar</button></div></header>
      <div className={styles.roleBanner}><div><strong>{ROLE_META[role].label}</strong><div className={styles.summary}>{ROLE_META[role].description}</div></div><span className={styles.badge}>{role==="super_admin"?"Tu vista principal":"Vista previa del perfil"}</span></div>
      {message&&<div className={styles.notice}>{message}</div>}
      {loading&&filteredEmpty("Cargando información del CRM...")}

      {!loading&&active==="Dashboard"&&<>
        <div className={styles.metrics}>
          <article className={styles.metric}><small>Conversaciones</small><strong>{data.call_events.length}</strong><span>WhatsApp y llamadas</span></article>
          <article className={styles.metric}><small>Citas de hoy</small><strong>{data.appointments.filter(item=>item.starts_at.startsWith(today)).length}</strong><span>{data.appointments.length} en agenda</span></article>
          <article className={styles.metric}><small>Órdenes activas</small><strong>{data.work_orders.filter(item=>!["completed","cancelled"].includes(item.status)).length}</strong><span>{data.work_orders.length} totales</span></article>
          <article className={styles.metric}><small>Pendientes técnicos</small><strong>{data.appointments.filter(item=>!item.technician_id).length}</strong><span>Requieren asignación</span></article>
        </div>
        <div className={styles.gridTwo}>
          <section className={styles.card}><div className={styles.cardHead}><div><span className={styles.eyebrow}>PRÓXIMAS VISITAS</span><h3>Agenda compacta</h3></div><button className={styles.secondary} onClick={()=>setActive("Agenda")}>Abrir</button></div>{data.appointments.slice(0,5).map(item=><div className={styles.row} key={item.id} style={{gridTemplateColumns:"145px 1fr 140px 105px"}}><strong>{localDate(item.starts_at)}</strong><div>{customersById.get(item.customer_id||"")?.full_name||"Sin nombre"}<p>{item.notes||"Servicio"}</p></div><span>{techniciansById.get(item.technician_id||"")?.full_name||"Sin técnico"}</span><span className={badgeClass(item.status)}>{statusLabel(item.status)}</span></div>)}</section>
          <section className={styles.card}><div className={styles.cardHead}><div><span className={styles.eyebrow}>ACTIVIDAD</span><h3>Conversaciones recientes</h3></div><button className={styles.secondary} onClick={()=>setActive("Conversaciones")}>Ver todas</button></div>{data.call_events.slice(0,5).map(item=>{const customer=customersByPhone.get(cleanPhone(item.customer_phone));return <div className={styles.row} key={item.id} style={{gridTemplateColumns:"90px 1fr 130px"}}><span className={styles.badge}>{channel(item)}</span><div><strong>{customer?.full_name||"Sin nombre registrado"}</strong><p>{item.summary||"Sin resumen"}</p></div><small>{localDate(item.created_at)}</small></div>})}</section>
        </div>
      </>}

      {!loading&&active==="Conversaciones"&&<section className={styles.card}>
        <div className={styles.cardHead}><div><span className={styles.eyebrow}>HISTORIAL COMPLETO</span><h3>Conversaciones y transcripciones</h3></div><span className={styles.badge}>{conversations.length} registros</span></div>
        <div className={styles.filters}><input className={styles.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente, teléfono o resumen..."/><select className={styles.select} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los canales</option><option value="WhatsApp">WhatsApp</option><option value="Llamada">Llamada</option></select></div>
        <div className={styles.tableWrap}><div className={styles.table}><div className={`${styles.headRow} ${styles.colsConversation}`}><span>N.º</span><span>Cliente</span><span>Resumen</span><span>Canal</span><span>Fecha</span><span>Acción</span></div>{conversations.map((item,index)=>{const customer=customersByPhone.get(cleanPhone(item.customer_phone));return <div className={`${styles.row} ${styles.colsConversation}`} key={item.id}><strong>#{index+1}</strong><div><strong>{customer?.full_name||"Sin nombre registrado"}</strong><p>{item.customer_phone||"Sin teléfono"}</p></div><span>{item.summary||"Sin resumen"}</span><span className={styles.badge}>{channel(item)}</span><small>{localDate(item.created_at)}</small><button className={styles.linkButton} onClick={()=>void openConversation(item)}>Ver detalle</button></div>})}</div></div>
      </section>}

      {!loading&&active==="Clientes"&&<section className={styles.card}>
        <div className={styles.cardHead}><div><span className={styles.eyebrow}>BASE PROPIA</span><h3>Clientes e historial</h3></div><span className={styles.badge}>{customers.length} clientes</span></div>
        <div className={styles.filters}><input className={styles.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nombre, teléfono, correo o dirección..."/><select className={styles.select} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los orígenes</option><option value="whatsapp">WhatsApp</option><option value="phone">Llamada</option><option value="presencial">Presencial</option><option value="crm">CRM</option></select></div>
        <div className={styles.tableWrap}><div className={styles.table}><div className={`${styles.headRow} ${styles.colsCustomer}`}><span>N.º</span><span>Cliente</span><span>Contacto</span><span>Dirección</span><span>Origen</span><span>Acciones</span></div>{customers.map((item,index)=><div className={`${styles.row} ${styles.colsCustomer}`} key={item.id}><strong>#{index+1}</strong><div><strong>{item.full_name?.trim()||"Sin nombre registrado"}</strong><p>{item.email||"Sin correo"}</p></div><span>{item.phone}</span><span>{[item.address,item.sector].filter(Boolean).join(", ")||"Sin dirección"}</span><span className={styles.badge}>{item.source||"crm"}</span><div className={styles.actions}>{can("edit_customer")&&actionButton("Editar",()=>setModal({kind:"customer",item}))}{actionButton("Historial",()=>void openHistory(item),"ghost")}</div></div>)}</div></div>
      </section>}

      {!loading&&active==="Técnicos"&&<section className={styles.card}>
        <div className={styles.cardHead}><div><span className={styles.eyebrow}>EQUIPO DE CAMPO</span><h3>Técnicos y disponibilidad</h3></div><span className={styles.badge}>{technicians.length} técnicos</span></div>
        <div className={styles.filters}><input className={styles.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nombre, especialidad o zona..."/><select className={styles.select} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los estados</option><option value="available">Disponible</option><option value="busy">Ocupado</option><option value="unavailable">No disponible</option></select></div>
        <div className={styles.tableWrap}><div className={styles.table}><div className={`${styles.headRow} ${styles.colsTech}`}><span>Técnico</span><span>WhatsApp</span><span>Especialidades / zonas</span><span>Estado</span><span>Acción</span></div>{technicians.map(item=><div className={`${styles.row} ${styles.colsTech}`} key={item.id}><strong>{item.full_name}</strong><span>{item.phone||"Sin número"}</span><div><span>{(item.specialties||[]).join(", ")||"Sin especialidad"}</span><p>{(item.zones||[]).join(", ")||"Sin zonas"}</p></div><span className={badgeClass(item.status)}>{statusLabel(item.status)}</span><div>{can("edit_technician")&&actionButton("Editar",()=>setModal({kind:"technician",item}))}</div></div>)}</div></div>
      </section>}

      {!loading&&active==="Agenda y Órdenes"&&<section className={`${styles.card} ${styles.compactAgenda}`}>
        <div className={styles.cardHead}><div><span className={styles.eyebrow}>OPERACIÓN DE CAMPO</span><h3>Agenda y órdenes</h3><p className={styles.summary}>Cada visita programada con su orden de trabajo — horario, cliente, equipo, falla y técnico en una sola vista.</p></div><span className={styles.badge}>{orders.length} órdenes</span></div>
        <div className={styles.filters}><input className={styles.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar orden, cliente, equipo, falla o dirección..."/><input className={styles.select} type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/><select className={styles.select} value={orderTypeFilter} onChange={e=>setOrderTypeFilter(e.target.value)}><option value="all">Reparación y venta</option><option value="reparacion_instalacion">Reparación / instalación</option><option value="venta_producto">Venta de producto</option></select><select className={styles.select} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los estados</option>{["new","scheduled","assigned","in_progress","pending_customer","approved","on_hold","completed","cancelled"].map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select><select className={styles.select} value={secondaryFilter} onChange={e=>setSecondaryFilter(e.target.value)}><option value="all">Todos los técnicos</option><option value="unassigned">Sin técnico</option>{data.technicians.map(item=><option key={item.id} value={item.id}>{item.full_name}</option>)}</select></div>
        <div className={styles.tableWrap}><div className={styles.table}><div className={`${styles.headRow} ${styles.colsAgendaOrders}`}><span>Orden</span><span>Fecha y hora</span><span>Cliente</span><span>Equipo / falla</span><span>Dirección</span><span>Técnico</span><span>Estado</span><span>Acciones</span></div>{orders.map(item=>{const customer=customersById.get(item.customer_id||"");const appt=appointmentsById.get(item.appointment_id||"");return <div className={`${styles.row} ${styles.colsAgendaOrders}`} key={item.id}><strong>{item.order_number}</strong><span>{appt?localDate(appt.starts_at):"Sin cita"}</span><div><strong>{customer?.full_name||"Sin nombre"}</strong><p>{customer?.phone||"Sin teléfono"}</p></div><div><span>{item.equipment||"Equipo"}</span><p>{item.issue||[item.brand,item.model].filter(Boolean).join(" · ")||"Sin detalle"}</p></div><span>{appt?.address||customer?.address||"Sin dirección"}</span><span>{techniciansById.get(item.technician_id||"")?.full_name||"Sin técnico"}</span><span className={badgeClass(item.status)}>{statusLabel(item.status)}</span><div className={styles.actions}>{can("update_order")&&actionButton("Gestionar",()=>setModal({kind:"order",item}))}{appt&&can("reschedule")&&actionButton("Cita",()=>setModal({kind:"appointment",item:appt}))}</div></div>})}</div></div>
      </section>}

      {!loading&&active==="Inventario"&&<section className={styles.card}>
        <div className={styles.cardHead}><div><span className={styles.eyebrow}>INVENTARIO</span><h3>Productos, equipos y piezas</h3></div><span className={styles.badge}>{products.length} registros</span></div>
        <div className={styles.filters}><input className={styles.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nombre, marca, modelo, SKU o pieza..."/><select className={styles.select} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los tipos</option><option value="equipment">Equipo</option><option value="product">Producto</option><option value="part">Pieza</option><option value="accessory">Accesorio</option></select></div>
        <div className={styles.tableWrap}><div className={styles.table}><div className={`${styles.headRow} ${styles.colsProduct}`}><span>N.º</span><span>Producto</span><span>Tipo</span><span>Precio</span><span>Inventario</span><span>Acción</span></div>{products.map((item,index)=>{const available=Math.max(0,item.stock-item.reserved_stock);return <div className={`${styles.row} ${styles.colsProduct}`} key={item.id}><strong>#{index+1}</strong><div><strong>{item.piece_name||item.name}</strong><p>{item.brand||"Sin marca"} · {item.model||"Sin modelo"} · {item.sku||"Sin SKU"}</p></div><span>{statusLabel(item.item_type)}</span><strong>{money(item.sale_price??item.price)}</strong><div><strong>{available} disponible(s)</strong><p>{item.stock} total · {item.reserved_stock} reservado(s)</p></div><div>{can("edit_product")&&actionButton("Editar",()=>setModal({kind:"product",item}))}</div></div>})}</div></div>
      </section>}

      {!loading&&active==="Cotizaciones"&&<section className={styles.card}><div className={styles.cardHead}><div><span className={styles.eyebrow}>COMERCIAL</span><h3>Cotizaciones</h3></div></div><div className={styles.tableWrap}><div className={styles.table}><div className={`${styles.headRow} ${styles.colsQuote}`}><span>Cotización</span><span>Cliente</span><span>Total</span><span>Estado</span><span>Fecha</span></div>{data.quotes.map(item=><div className={`${styles.row} ${styles.colsQuote}`} key={item.id}><strong>{item.quote_number}</strong><span>{customersById.get(item.customer_id||"")?.full_name||"Sin nombre"}</span><strong>{money(item.total)}</strong><span className={badgeClass(item.status)}>{statusLabel(item.status)}</span><small>{localDate(item.created_at)}</small></div>)}</div></div></section>}

      {!loading&&active==="Ventas"&&<section className={styles.card}><div className={styles.cardHead}><div><span className={styles.eyebrow}>RESULTADOS</span><h3>Ventas</h3></div></div>{data.sales.length?data.sales.map(item=><div className={styles.row} key={item.id} style={{gridTemplateColumns:"1.4fr 120px 150px 120px 160px"}}><strong>{customersById.get(item.customer_id||"")?.full_name||"Sin nombre"}</strong><span>{item.quantity} unidad(es)</span><strong>{money(item.unit_price)}</strong><span className={badgeClass(item.status)}>{statusLabel(item.status)}</span><small>{localDate(item.created_at)}</small></div>):filteredEmpty("No hay ventas registradas.")}</section>}
    </section>

    {modal&&<div className={styles.modalBack}><div className={`${styles.modal} ${(modal.kind==="conversation"||modal.kind==="history")?styles.modalWide:""}`}>
      <div className={styles.modalHead}><div><span className={styles.eyebrow}>TECHCOMM OPERATIONS</span><h2>{modal.kind==="manual"?"Nueva gestión":modal.kind==="appointment"?"Gestionar cita":modal.kind==="order"?"Gestionar orden":modal.kind==="conversation"?"Conversación completa":modal.kind==="history"?"Historial del cliente":`Editar ${modal.kind}`}</h2></div><button className={styles.close} onClick={()=>{setModal(null);setConversationDetail(null);setHistory([])}}>×</button></div>

      {modal.kind==="conversation"&&<>{conversationDetail?<><div className={styles.detailGrid}><div className={styles.detailBox}><small>Canal</small><strong>{channel(modal.item)}</strong></div><div className={styles.detailBox}><small>Fecha</small><strong>{localDate(modal.item.created_at)}</strong></div><div className={styles.detailBox}><small>Teléfono</small><strong>{modal.item.customer_phone||"No disponible"}</strong></div></div><div className={styles.notice}>{conversationDetail.event?.summary||modal.item.summary||"Sin resumen"}</div>{conversationDetail.audio_url?<div className={styles.notice}><small style={{display:"block",marginBottom:8,color:"var(--muted)"}}>Grabación de la llamada — conservada para fines regulatorios (INDOTEL)</small><audio controls style={{width:"100%"}} src={conversationDetail.audio_url} /></div>:null}<div className={styles.transcript}>{conversationDetail.messages.length?conversationDetail.messages.map(message=><div key={message.id} className={`${styles.bubble} ${message.role==="user"?styles.bubbleUser:""}`}><small>{message.role==="user"?"Cliente":"Techcomm Assistant"} · {localDate(message.created_at)}</small>{message.content}</div>):<div className={styles.empty}>No hay mensajes detallados disponibles.</div>}</div></>:<div className={styles.empty}>Cargando conversación...</div>}</>}

      {modal.kind==="history"&&<div className={styles.timeline}>{history.length?history.map(item=><div className={styles.timelineItem} key={item.id}><time>{localDate(item.date)}</time><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.type}</small></div></div>):<div className={styles.empty}>Cargando historial...</div>}</div>}

      {!["conversation","history"].includes(modal.kind)&&<form className={styles.form} onSubmit={saveModal}>
        {modal.kind==="customer"&&<div className={styles.formGrid}><label>Nombre completo<input className={styles.input} name="full_name" defaultValue={modal.item.full_name||""} required/></label><label>Teléfono<input className={styles.input} name="phone" defaultValue={modal.item.phone} required/></label><label>Correo<input className={styles.input} name="email" defaultValue={modal.item.email||""}/></label><label>Sector<input className={styles.input} name="sector" defaultValue={modal.item.sector||""}/></label><label style={{gridColumn:"1/-1"}}>Dirección<input className={styles.input} name="address" defaultValue={modal.item.address||""}/></label></div>}
        {modal.kind==="technician"&&<div className={styles.formGrid}><label>Nombre completo<input className={styles.input} name="full_name" defaultValue={modal.item.full_name} required/></label><label>WhatsApp<input className={styles.input} name="phone" defaultValue={modal.item.phone||""} required/></label><label>Especialidades<input className={styles.input} name="specialties" defaultValue={(modal.item.specialties||[]).join(", ")}/></label><label>Zonas<input className={styles.input} name="zones" defaultValue={(modal.item.zones||[]).join(", ")}/></label><label>Disponibilidad<select className={styles.select} name="status" defaultValue={modal.item.status}><option value="available">Disponible</option><option value="busy">Ocupado</option><option value="unavailable">No disponible</option></select></label><label><span>Notificaciones</span><span><input type="checkbox" name="whatsapp_enabled" defaultChecked={modal.item.whatsapp_enabled!==false}/> WhatsApp activo</span></label></div>}
        {modal.kind==="product"&&<div className={styles.formGrid}><label>SKU<input className={styles.input} name="sku" defaultValue={modal.item.sku||""}/></label><label>Tipo<select className={styles.select} name="item_type" defaultValue={modal.item.item_type||"product"}><option value="equipment">Equipo</option><option value="product">Producto</option><option value="part">Pieza</option><option value="accessory">Accesorio</option></select></label><label>Nombre<input className={styles.input} name="name" defaultValue={modal.item.name} required/></label><label>Pieza<input className={styles.input} name="piece_name" defaultValue={modal.item.piece_name||""}/></label><label>Marca<input className={styles.input} name="brand" defaultValue={modal.item.brand||""}/></label><label>Modelo<input className={styles.input} name="model" defaultValue={modal.item.model||""}/></label><label>Categoría<input className={styles.input} name="category" defaultValue={modal.item.category||""}/></label><label>Precio de venta<input className={styles.input} type="number" name="sale_price" defaultValue={modal.item.sale_price??modal.item.price??0}/></label><label>Costo unitario<input className={styles.input} type="number" name="unit_cost" defaultValue={modal.item.unit_cost||0}/></label><label>Descuento máximo (%)<input className={styles.input} type="number" name="max_discount_pct" defaultValue={(modal.item.max_discount_pct||0)*100}/></label><label>Stock total<input className={styles.input} type="number" name="stock" defaultValue={modal.item.stock}/></label><label>Reservado<input className={styles.input} type="number" name="reserved_stock" defaultValue={modal.item.reserved_stock}/></label><label>Instalación<input className={styles.input} type="number" name="installation_price" defaultValue={modal.item.installation_price||0}/></label><label>Envío<input className={styles.input} type="number" name="delivery_price" defaultValue={modal.item.delivery_price||0}/></label><label style={{gridColumn:"1/-1"}}>Descripción<textarea className={styles.textarea} name="description" defaultValue={modal.item.description||""}/></label><label><span><input type="checkbox" name="installation_includes_delivery" defaultChecked={Boolean(modal.item.installation_includes_delivery)}/> Instalación incluye envío</span></label></div>}
        {modal.kind==="appointment"&&<div className={styles.formGrid}><label>Fecha y hora<input className={styles.input} type="datetime-local" name="starts_at" defaultValue={toLocalInput(modal.item.starts_at)} required/></label><label>Estado<select className={styles.select} name="status" defaultValue={modal.item.status}><option value="scheduled">Programada</option><option value="confirmed">Confirmada</option><option value="rescheduled">Reprogramada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></label><label style={{gridColumn:"1/-1"}}>Técnico<select className={styles.select} name="technician_id" defaultValue={modal.item.technician_id||""}><option value="">Sin técnico</option>{data.technicians.map(item=><option key={item.id} value={item.id}>{item.full_name} · {statusLabel(item.status)}</option>)}</select></label><div className={styles.notice} style={{gridColumn:"1/-1"}}>Al reprogramar, la prueba de confirmación telefónica quedará en cola para 2 minutos después de la hora de la visita.</div></div>}
        {modal.kind==="order"&&<div className={styles.formGrid}><label>Estado<select className={styles.select} name="status" defaultValue={modal.item.status}>{["new","scheduled","assigned","in_progress","pending_customer","approved","on_hold","completed","cancelled"].map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label>Prioridad<select className={styles.select} name="priority" defaultValue={modal.item.priority||"normal"}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label style={{gridColumn:"1/-1"}}>Técnico<select className={styles.select} name="technician_id" defaultValue={modal.item.technician_id||""}><option value="">Sin técnico</option>{data.technicians.map(item=><option key={item.id} value={item.id}>{item.full_name} · {statusLabel(item.status)}</option>)}</select></label></div>}
        {modal.kind==="manual"&&<ManualFields customers={data.customers} technicians={data.technicians}/>} 
        <div className={styles.formActions}><button type="button" className={styles.ghost} onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className={styles.button}>Guardar</button></div>
      </form>}
    </div></div>}
  </main>;
}

function ManualFields({customers,technicians}:{customers:Customer[];technicians:Technician[]}){
  const [action,setAction]=useState("customer");
  return <>
    <label>Tipo de gestión<select className={styles.select} name="action" value={action} onChange={event=>setAction(event.target.value)}><option value="customer">Registrar o actualizar cliente</option><option value="appointment">Crear cita</option><option value="order">Crear orden presencial</option></select></label>
    <label>Cliente existente<select className={styles.select} name="customer_id"><option value="">Crear o localizar por teléfono</option>{customers.map(item=><option key={item.id} value={item.id}>{item.full_name||"Sin nombre"} · {item.phone}</option>)}</select></label>
    <div className={styles.formGrid}><label>Nombre completo<input className={styles.input} name="customer_name"/></label><label>Teléfono<input className={styles.input} name="phone"/></label><label>Correo<input className={styles.input} name="email"/></label><label>Sector<input className={styles.input} name="sector"/></label><label style={{gridColumn:"1/-1"}}>Dirección<input className={styles.input} name="address"/></label></div>
    {action==="appointment"&&<div className={styles.formGrid}><label>Fecha y hora<input className={styles.input} type="datetime-local" name="starts_at" required/></label><label>Técnico<select className={styles.select} name="technician_id"><option value="">Sin asignar</option>{technicians.map(item=><option key={item.id} value={item.id}>{item.full_name} · {statusLabel(item.status)}</option>)}</select></label><label style={{gridColumn:"1/-1"}}>Servicio / notas<input className={styles.input} name="notes" required/></label></div>}
    {action==="order"&&<div className={styles.formGrid}><label>Equipo<input className={styles.input} name="equipment" required/></label><label>Marca<input className={styles.input} name="brand"/></label><label>Modelo<input className={styles.input} name="model"/></label><label>Prioridad<select className={styles.select} name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label style={{gridColumn:"1/-1"}}>Falla o solicitud<textarea className={styles.textarea} name="issue" required/></label><label style={{gridColumn:"1/-1"}}>Técnico<select className={styles.select} name="technician_id"><option value="">Sin asignar</option>{technicians.map(item=><option key={item.id} value={item.id}>{item.full_name} · {statusLabel(item.status)}</option>)}</select></label></div>}
  </>;
}
