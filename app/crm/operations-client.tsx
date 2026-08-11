"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, MessagesSquare, Users, CalendarClock, Wrench, ShoppingCart,
  Package, FileText, ShieldCheck, Activity, Settings, Menu, PanelLeftClose,
  PanelLeft, RefreshCw, Plus, LogOut, Search, Phone, MessageCircle,
  AlertTriangle, CheckCircle2, Volume2, MapPin, ClipboardList, ArrowRight,
  type LucideIcon,
} from "lucide-react";
import styles from "./operations-client.module.css";
import { signOut } from "../login/actions";
import {
  Kpi, StatusBadge, Drawer, Modal, AudioPlayer, EmptyState, TableSkeleton, LogoMark,
  type Tone,
} from "@/components/tc-ui";
import InventoryPanel from "@/components/inventory-panel";

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;

type Role = "super_admin" | "admin" | "secretary" | "supervisor" | "technician";
type Permission = "edit_customer" | "edit_technician" | "edit_product" | "reschedule" | "reassign" | "update_order" | "manual_management" | "view_financial";

type Customer = { id:string; full_name?:string|null; phone:string; email?:string|null; address?:string|null; sector?:string|null; source?:string|null; created_at?:string; updated_at?:string };
type Product = { id:string; sku?:string|null; name:string; piece_name?:string|null; description?:string|null; item_type?:string|null; category?:string|null; brand?:string|null; model?:string|null; unit_cost?:number|null; sale_price?:number|null; price?:number|null; max_discount_pct?:number|null; minimum_authorized_price?:number|null; installation_price?:number|null; delivery_price?:number|null; installation_includes_delivery?:boolean|null; stock:number; reserved_stock:number; active?:boolean };
type Technician = { id:string; full_name:string; phone?:string|null; specialties?:string[]|null; zones?:string[]|null; status:string; whatsapp_enabled?:boolean };
type Appointment = { id:string; customer_id?:string|null; technician_id?:string|null; starts_at:string; ends_at?:string|null; address?:string|null; status:string; confirmation_status?:string|null; technician_confirmation_status?:string|null; requires_manual_assignment?:boolean; notes?:string|null; created_at?:string; updated_at?:string };
type WorkOrder = { id:string; order_number:string; order_type?:string|null; customer_id?:string|null; appointment_id?:string|null; technician_id?:string|null; equipment?:string|null; brand?:string|null; model?:string|null; issue?:string|null; status:string; priority?:string|null; source?:string|null; created_at?:string; updated_at?:string };
type Quote = { id:string; quote_number:string; customer_id?:string|null; status:string; total?:number|null; created_at?:string; expires_at?:string|null };
type Sale = { id:string; customer_id?:string|null; product_id?:string|null; quantity:number; unit_price:number; status:string; source?:string|null; created_at?:string };
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
  available:"Disponible", busy:"Ocupado", unavailable:"No disponible", new:"Nueva", scheduled:"Programada", confirmed:"Confirmada", rescheduled:"Reprogramada", assigned:"Asignada", in_progress:"En proceso", pending_customer:"Pendiente cliente", approved:"Aprobada", on_hold:"En espera", completed:"Completada", cancelled:"Cancelada", pending:"Pendiente", sent:"Enviada", failed:"Fallida", draft:"Borrador", accepted:"Aceptada", done:"Completada", rejected:"Rechazada", expired:"Vencida",
};

const NAV_GROUPS: { label:string; items:{ key:string; Icon:LucideIcon }[] }[] = [
  { label:"General", items:[{ key:"Dashboard", Icon:LayoutDashboard }] },
  { label:"Operación", items:[
    { key:"Conversaciones", Icon:MessagesSquare },
    { key:"Clientes", Icon:Users },
    { key:"Agenda y Órdenes", Icon:CalendarClock },
    { key:"Técnicos", Icon:Wrench },
  ] },
  { label:"Comercial", items:[
    { key:"Ventas", Icon:ShoppingCart },
    { key:"Inventario", Icon:Package },
    { key:"Cotizaciones", Icon:FileText },
  ] },
];

function money(value?:number|null){ return value==null?"Por confirmar":new Intl.NumberFormat("es-DO",{style:"currency",currency:"DOP",maximumFractionDigits:2}).format(value); }
function cleanPhone(value?:string|null){ return String(value||"").replace(/\D/g,"").replace(/^1(?=8(?:09|29|49))/ ,""); }
function statusLabel(value?:string|null){ return value?STATUS_LABELS[value]||value:"Pendiente"; }
function localDate(value?:string|null){ return value?new Date(value).toLocaleString("es-DO",{dateStyle:"medium",timeStyle:"short"}):"Sin fecha"; }
function toLocalInput(value?:string|null){ if(!value)return ""; const date=new Date(value); const offset=date.getTimezoneOffset(); return new Date(date.getTime()-offset*60000).toISOString().slice(0,16); }
function channel(event:CallEvent){ const raw=String(event.metadata?.channel??event.metadata?.source??"").toLowerCase(); return raw.includes("whatsapp")?"WhatsApp":"Llamada"; }
function intentLabel(event:CallEvent){ const raw=String(event.metadata?.intent??"").trim(); if(!raw)return "—"; return raw.charAt(0).toUpperCase()+raw.slice(1).replace(/_/g," "); }

function toneFor(value?:string|null):Tone{
  const v=String(value||"");
  if(["completed","confirmed","accepted","available","sent","done","approved"].includes(v))return "good";
  if(["cancelled","failed","unavailable","rejected","expired"].includes(v))return "bad";
  if(["pending","busy","on_hold","pending_customer","rescheduled","scheduled","assigned","new","in_progress","draft"].includes(v))return "warning";
  return "neutral";
}

export default function OperationsClient({ canOpenAudit = false }: { canOpenAudit?: boolean }){
  const [data,setData]=useState<Overview>(EMPTY);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [active,setActive]=useState("Dashboard");
  const [role,setRole]=useState<Role>("super_admin");
  const [modal,setModal]=useState<ModalState>(null);
  const [conversationDetail,setConversationDetail]=useState<{messages:DetailMessage[];event?:CallEvent;audio_url?:string|null}|null>(null);
  const [audioRevealed,setAudioRevealed]=useState(false);
  const [history,setHistory]=useState<TimelineItem[]>([]);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [secondaryFilter,setSecondaryFilter]=useState("all");
  const [orderTypeFilter,setOrderTypeFilter]=useState("all");
  const [dateFilter,setDateFilter]=useState("");
  const [collapsed,setCollapsed]=useState(false);
  const [mobileOpen,setMobileOpen]=useState(false);

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
  useEffect(()=>{ setMobileOpen(false); },[active]);

  const can=(permission:Permission)=>ROLE_META[role].permissions.includes(permission);
  const customersById=useMemo(()=>new Map(data.customers.map(item=>[item.id,item])),[data.customers]);
  const customersByPhone=useMemo(()=>new Map(data.customers.map(item=>[cleanPhone(item.phone),item])),[data.customers]);
  const techniciansById=useMemo(()=>new Map(data.technicians.map(item=>[item.id,item])),[data.technicians]);
  const appointmentsById=useMemo(()=>new Map(data.appointments.map(item=>[item.id,item])),[data.appointments]);
  const productsById=useMemo(()=>new Map(data.products.map(item=>[item.id,item])),[data.products]);
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

  const activeOrders=data.work_orders.filter(item=>!["completed","cancelled"].includes(item.status)).length;
  const unassigned=data.appointments.filter(item=>!item.technician_id).length;
  const todayAppointments=data.appointments.filter(item=>item.starts_at.startsWith(today)).length;
  const availableTechs=data.technicians.filter(item=>item.status==="available").length;
  const pendingQuotes=data.quotes.filter(item=>["pending","sent","draft"].includes(item.status)).length;
  const outOfStock=data.products.filter(item=>Math.max(0,item.stock-item.reserved_stock)<=0).length;
  const salesTotal=data.sales.reduce((sum,item)=>sum+(item.unit_price||0)*(item.quantity||0),0);

  const last7=useMemo(()=>[...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().slice(0,10); }),[]);
  const convSpark=useMemo(()=>last7.map(day=>data.call_events.filter(event=>String(event.created_at).slice(0,10)===day).length),[last7,data.call_events]);
  const apptSpark=useMemo(()=>last7.map(day=>data.appointments.filter(item=>item.starts_at.slice(0,10)===day).length),[last7,data.appointments]);

  const nowMs=Date.now();
  const upcomingVisits=useMemo(()=>[...data.appointments].filter(item=>new Date(item.starts_at).getTime()>=nowMs-3600000).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,5),[data.appointments,nowMs]);
  const ordersNeedingAttention=useMemo(()=>data.work_orders.filter(item=>(!item.technician_id||["pending_customer","on_hold"].includes(item.status))&&!["completed","cancelled"].includes(item.status)).slice(0,6),[data.work_orders]);
  const recentConversations=data.call_events.slice(0,5);
  const pendingQuotesList=useMemo(()=>data.quotes.filter(item=>["pending","sent","draft"].includes(item.status)).slice(0,5),[data.quotes]);

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
      closeOverlay(); setMessage("Cambios guardados correctamente."); await load();
    }catch(error){ setMessage(error instanceof Error?error.message:"No fue posible guardar."); }
  }

  async function openConversation(item:CallEvent){
    setModal({kind:"conversation",item}); setConversationDetail(null); setAudioRevealed(false);
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

  function closeOverlay(){ setModal(null); setConversationDetail(null); setHistory([]); setAudioRevealed(false); }
  function goto(section:string){ if(ROLE_META[role].menus.includes(section))setActive(section); }

  const editModal = modal && !["conversation","history"].includes(modal.kind);
  const modalTitle = modal ? (modal.kind==="manual"?"Nueva gestión":modal.kind==="appointment"?"Gestionar cita":modal.kind==="order"?"Gestionar orden":modal.kind==="customer"?"Editar cliente":modal.kind==="technician"?"Editar técnico":modal.kind==="product"?"Editar producto":"") : "";

  return (
    <div className={`${styles.shell} tcTheme`}>
      {mobileOpen && <div className={styles.mobileBackdrop} onClick={()=>setMobileOpen(false)} aria-hidden="true" />}

      <aside className={`${styles.sidebar} ${collapsed?styles.collapsed:""} ${mobileOpen?styles.mobileOpen:""}`}>
        <div className={styles.brand}>
          <LogoMark chipClass={styles.logoChip} fallback={<span className={styles.logoFallback}>Tech<b>comm</b></span>} />
          <div className={styles.brandText}><strong>Techcomm</strong><span>Operations</span></div>
        </div>

        <div className={styles.profile}>
          <small>Vista de perfil</small>
          <select className="tc-select" value={role} onChange={event=>setRole(event.target.value as Role)} aria-label="Perfil de presentación">
            {Object.entries(ROLE_META).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}
          </select>
          <p>{ROLE_META[role].description}</p>
        </div>

        <nav className={`${styles.navScroll} tc-scroll`}>
          {NAV_GROUPS.map(group=>{
            const items=group.items.filter(item=>ROLE_META[role].menus.includes(item.key));
            if(!items.length)return null;
            return (
              <div className={styles.navGroup} key={group.label}>
                <span className={styles.navGroupLabel}>{group.label}</span>
                {items.map(({key,Icon})=>(
                  <button key={key} type="button" className={`${styles.navItem} ${active===key?styles.active:""}`} onClick={()=>setActive(key)}>
                    <Icon /><span className={styles.navLabel}>{key}</span><span className={styles.tip}>{key}</span>
                  </button>
                ))}
              </div>
            );
          })}

          {canOpenAudit && (
            <div className={styles.navGroup}>
              <span className={styles.navGroupLabel}>Control</span>
              <Link className={`${styles.navItem} ${styles.navLink}`} href="/admin/auditoria"><ShieldCheck /><span className={styles.navLabel}>Auditoría</span><span className={styles.tip}>Auditoría</span></Link>
              <Link className={`${styles.navItem} ${styles.navLink}`} href="/crm/health"><Activity /><span className={styles.navLabel}>Salud del sistema</span><span className={styles.tip}>Salud del sistema</span></Link>
              <Link className={`${styles.navItem} ${styles.navLink}`} href="/admin"><Settings /><span className={styles.navLabel}>Administración</span><span className={styles.tip}>Administración</span></Link>
            </div>
          )}
        </nav>

        <div className={styles.sideFoot}>
          <span><span className={styles.dot}/>Supabase conectado</span>
          <span><span className={styles.dot}/>WhatsApp y voz activos</span>
          <span><span className={styles.dot}/>Cierre automático tras 5 min</span>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button type="button" className={`${styles.iconToggle} ${styles.mobileToggle}`} onClick={()=>setMobileOpen(true)} aria-label="Abrir menú"><Menu /></button>
            <button type="button" className={`${styles.iconToggle} ${styles.desktopCollapse}`} onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?"Expandir menú":"Colapsar menú"}>{collapsed?<PanelLeft/>:<PanelLeftClose/>}</button>
            <div className={styles.topTitle}><small>Operación en tiempo real</small><strong>{active}</strong></div>
          </div>
          <div className={styles.topbarRight}>
            <span className={`${styles.alertPill} ${unassigned?"":styles.calm}`} title="Órdenes/citas sin técnico">
              {unassigned?<AlertTriangle/>:<CheckCircle2/>}{unassigned?`${unassigned} sin asignar`:"Operación al día"}
            </span>
            {can("manual_management")&&<button type="button" className="tc-btn tc-btn-sm" onClick={()=>{setModal({kind:"manual"});}}><Plus/>Nueva gestión</button>}
            <button type="button" className={styles.iconToggle} onClick={()=>void load()} aria-label="Actualizar" title="Actualizar"><RefreshCw/></button>
            <button type="button" className={styles.iconToggle} onClick={()=>void signOut()} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut/></button>
          </div>
        </header>

        <main className={`${styles.content} tc-scroll`}>
          {message&&<div className="tc-notice"><AlertTriangle/><span>{message}</span><button type="button" className="tc-linkbtn" style={{marginLeft:"auto"}} onClick={()=>setMessage("")}>Cerrar</button></div>}

          {loading?(
            <div className="tc-card"><TableSkeleton rows={8} cols={5}/></div>
          ):(<>
            {active==="Dashboard"&&<>
              <div className="tc-kpi-grid">
                <Kpi label="Conversaciones" value={data.call_events.length} icon={<MessagesSquare/>} tone="accent" spark={convSpark} sub={<><MessageCircle size={13}/>WhatsApp y llamadas</>} />
                <Kpi label="Citas de hoy" value={todayAppointments} icon={<CalendarClock/>} tone="info" spark={apptSpark} sub={<>{data.appointments.length} en agenda</>} />
                <Kpi label="Órdenes activas" value={activeOrders} icon={<ClipboardList/>} tone="accent" sub={<>{data.work_orders.length} totales</>} />
                <Kpi label="Pendientes de asignación" value={unassigned} icon={<AlertTriangle/>} tone={unassigned?"warning":"good"} sub={<>Requieren técnico</>} />
                <Kpi label="Técnicos disponibles" value={`${availableTechs}/${data.technicians.length}`} icon={<Wrench/>} tone="good" sub={<>En el equipo de campo</>} />
                <Kpi label="Cotizaciones pendientes" value={pendingQuotes} icon={<FileText/>} tone="info" sub={<>{data.quotes.length} totales</>} />
                <Kpi label="Ventas" value={data.sales.length} icon={<ShoppingCart/>} tone="good" sub={<>{money(salesTotal)}</>} />
                <Kpi label="Alertas de inventario" value={outOfStock} icon={<Package/>} tone={outOfStock?"bad":"good"} sub={<>Sin stock disponible</>} />
              </div>

              <div className={styles.dashGrid}>
                <SectionCard eyebrow="Próximas visitas" title="Agenda compacta" onOpen={ROLE_META[role].menus.includes("Agenda y Órdenes")?()=>goto("Agenda y Órdenes"):undefined}>
                  {upcomingVisits.length?upcomingVisits.map(item=>(
                    <div className={styles.listRow} key={item.id}>
                      <div className={styles.listMain}><strong>{customersById.get(item.customer_id||"")?.full_name||"Sin nombre"}</strong><span>{item.notes||"Servicio programado"} · {techniciansById.get(item.technician_id||"")?.full_name||"Sin técnico"}</span></div>
                      <div className={styles.listMeta}>{localDate(item.starts_at)}<div style={{marginTop:4}}><StatusBadge tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusBadge></div></div>
                    </div>
                  )):<EmptyState title="Sin visitas próximas" message="No hay citas programadas por ahora." icon={<CalendarClock size={20}/>} />}
                </SectionCard>

                <SectionCard eyebrow="Requiere atención" title="Órdenes por gestionar" onOpen={ROLE_META[role].menus.includes("Agenda y Órdenes")?()=>goto("Agenda y Órdenes"):undefined}>
                  {ordersNeedingAttention.length?ordersNeedingAttention.map(item=>(
                    <div className={styles.listRow} key={item.id}>
                      <div className={styles.listMain}><strong>{item.order_number} · {customersById.get(item.customer_id||"")?.full_name||"Sin nombre"}</strong><span>{item.issue||item.equipment||"Sin detalle"}</span></div>
                      <div className={styles.listMeta}>{item.technician_id?<StatusBadge tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusBadge>:<StatusBadge tone="warning">Sin técnico</StatusBadge>}</div>
                    </div>
                  )):<EmptyState title="Todo en orden" message="Ninguna orden requiere atención inmediata." icon={<CheckCircle2 size={20}/>} />}
                </SectionCard>

                <SectionCard eyebrow="Actividad" title="Conversaciones recientes" onOpen={ROLE_META[role].menus.includes("Conversaciones")?()=>goto("Conversaciones"):undefined}>
                  {recentConversations.length?recentConversations.map(item=>{const customer=customersByPhone.get(cleanPhone(item.customer_phone));return(
                    <div className={styles.listRow} key={item.id}>
                      <div className={styles.listMain}><strong>{customer?.full_name||"Sin nombre registrado"}</strong><span>{item.summary||"Sin resumen"}</span></div>
                      <div className={styles.listMeta}><StatusBadge tone={channel(item)==="WhatsApp"?"good":"info"} plain>{channel(item)}</StatusBadge><div style={{marginTop:4}}>{localDate(item.created_at)}</div></div>
                    </div>
                  );}):<EmptyState title="Sin actividad" message="Aún no hay conversaciones registradas." icon={<MessagesSquare size={20}/>} />}
                </SectionCard>

                <SectionCard eyebrow="Comercial" title="Cotizaciones pendientes" onOpen={ROLE_META[role].menus.includes("Cotizaciones")?()=>goto("Cotizaciones"):undefined}>
                  {pendingQuotesList.length?pendingQuotesList.map(item=>(
                    <div className={styles.listRow} key={item.id}>
                      <div className={styles.listMain}><strong>{item.quote_number} · {customersById.get(item.customer_id||"")?.full_name||"Sin nombre"}</strong><span>{money(item.total)}</span></div>
                      <div className={styles.listMeta}><StatusBadge tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusBadge></div>
                    </div>
                  )):<EmptyState title="Sin cotizaciones" message="No hay cotizaciones pendientes." icon={<FileText size={20}/>} />}
                </SectionCard>
              </div>
            </>}

            {active==="Conversaciones"&&<div className="tc-card">
              <div className="tc-card-head"><div><span className="tc-card-title-eyebrow">Historial</span><h3>Conversaciones</h3></div><StatusBadge tone="neutral" plain>{conversations.length} registros</StatusBadge></div>
              <div className="tc-filterbar">
                <div className="tc-search"><Search/><input className="tc-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente, teléfono o resumen..." /></div>
                <select className="tc-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los canales</option><option value="WhatsApp">WhatsApp</option><option value="Llamada">Llamada</option></select>
              </div>
              <div className="tc-tablewrap tc-scroll">
                <table className="tc-table">
                  <thead><tr><th>Cliente</th><th>Canal</th><th>Fecha y hora</th><th>Motivo</th><th>Estado</th><th style={{textAlign:"right"}}>Acción</th></tr></thead>
                  <tbody>{conversations.map(item=>{const customer=customersByPhone.get(cleanPhone(item.customer_phone));return(
                    <tr key={item.id}>
                      <td><div className="tc-strong">{customer?.full_name||"Sin nombre registrado"}</div><div className="tc-cell-sub">{item.customer_phone||"Sin teléfono"}</div></td>
                      <td><StatusBadge tone={channel(item)==="WhatsApp"?"good":"info"} plain>{channel(item)==="WhatsApp"?<MessageCircle size={13}/>:<Phone size={13}/>}{channel(item)}</StatusBadge></td>
                      <td>{localDate(item.created_at)}</td>
                      <td>{intentLabel(item)}</td>
                      <td><StatusBadge tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusBadge></td>
                      <td><div className="tc-rowactions"><button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={()=>void openConversation(item)}>Ver detalle</button></div></td>
                    </tr>
                  );})}</tbody>
                </table>
                {!conversations.length&&<EmptyState title="Sin conversaciones" message="No hay registros que coincidan con el filtro." icon={<MessagesSquare size={20}/>} />}
              </div>
            </div>}

            {active==="Clientes"&&<div className="tc-card">
              <div className="tc-card-head"><div><span className="tc-card-title-eyebrow">Base propia</span><h3>Clientes</h3></div><StatusBadge tone="neutral" plain>{customers.length} clientes</StatusBadge></div>
              <div className="tc-filterbar">
                <div className="tc-search"><Search/><input className="tc-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nombre, teléfono, correo o dirección..." /></div>
                <select className="tc-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los orígenes</option><option value="whatsapp">WhatsApp</option><option value="phone">Llamada</option><option value="presencial">Presencial</option><option value="crm">CRM</option></select>
              </div>
              <div className="tc-tablewrap tc-scroll">
                <table className="tc-table">
                  <thead><tr><th>Cliente</th><th>Contacto</th><th>Ubicación</th><th>Origen</th><th style={{textAlign:"right"}}>Acciones</th></tr></thead>
                  <tbody>{customers.map(item=>(
                    <tr key={item.id}>
                      <td><div className="tc-strong">{item.full_name?.trim()||"Sin nombre registrado"}</div><div className="tc-cell-sub">{item.email||"Sin correo"}</div></td>
                      <td>{item.phone}</td>
                      <td><div className="tc-truncate">{[item.address,item.sector].filter(Boolean).join(", ")||"Sin dirección"}</div></td>
                      <td><StatusBadge tone="info" plain>{item.source||"crm"}</StatusBadge></td>
                      <td><div className="tc-rowactions">{can("edit_customer")&&<button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={()=>setModal({kind:"customer",item})}>Editar</button>}<button type="button" className="tc-btn tc-btn-ghost tc-btn-sm" onClick={()=>void openHistory(item)}>Historial</button></div></td>
                    </tr>
                  ))}</tbody>
                </table>
                {!customers.length&&<EmptyState title="Sin clientes" message="No hay clientes que coincidan con el filtro." icon={<Users size={20}/>} />}
              </div>
            </div>}

            {active==="Técnicos"&&<div className="tc-card">
              <div className="tc-card-head"><div><span className="tc-card-title-eyebrow">Equipo de campo</span><h3>Técnicos y disponibilidad</h3></div><StatusBadge tone="neutral" plain>{technicians.length} técnicos</StatusBadge></div>
              <div className="tc-filterbar">
                <div className="tc-search"><Search/><input className="tc-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nombre, especialidad o zona..." /></div>
                <select className="tc-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los estados</option><option value="available">Disponible</option><option value="busy">Ocupado</option><option value="unavailable">No disponible</option></select>
              </div>
              <div className="tc-tablewrap tc-scroll">
                <table className="tc-table">
                  <thead><tr><th>Técnico</th><th>Estado</th><th>Especialidades / zonas</th><th>WhatsApp</th><th style={{textAlign:"right"}}>Acción</th></tr></thead>
                  <tbody>{technicians.map(item=>(
                    <tr key={item.id}>
                      <td><div className="tc-strong">{item.full_name}</div><div className="tc-cell-sub">{item.phone||"Sin número"}</div></td>
                      <td><StatusBadge tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusBadge></td>
                      <td><div className="tc-truncate">{(item.specialties||[]).join(", ")||"Sin especialidad"}</div><div className="tc-cell-sub">{(item.zones||[]).join(", ")||"Sin zonas"}</div></td>
                      <td>{item.whatsapp_enabled!==false?<StatusBadge tone="good">Activo</StatusBadge>:<StatusBadge tone="neutral">Inactivo</StatusBadge>}</td>
                      <td><div className="tc-rowactions">{can("edit_technician")&&<button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={()=>setModal({kind:"technician",item})}>Editar</button>}</div></td>
                    </tr>
                  ))}</tbody>
                </table>
                {!technicians.length&&<EmptyState title="Sin técnicos" message="No hay técnicos que coincidan con el filtro." icon={<Wrench size={20}/>} />}
              </div>
            </div>}

            {active==="Agenda y Órdenes"&&<div className="tc-card">
              <div className="tc-card-head"><div><span className="tc-card-title-eyebrow">Operación de campo</span><h3>Agenda y órdenes</h3><p>Cada visita con su orden de trabajo — horario, cliente, equipo, falla y técnico en una sola vista.</p></div><StatusBadge tone="neutral" plain>{orders.length} órdenes</StatusBadge></div>
              <div className="tc-filterbar">
                <div className="tc-search"><Search/><input className="tc-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar orden, cliente, equipo, falla o dirección..." /></div>
                <input className="tc-input" style={{maxWidth:160}} type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
                <select className="tc-select" value={orderTypeFilter} onChange={e=>setOrderTypeFilter(e.target.value)}><option value="all">Reparación y venta</option><option value="reparacion_instalacion">Reparación / instalación</option><option value="venta_producto">Venta de producto</option></select>
                <select className="tc-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos los estados</option>{["new","scheduled","assigned","in_progress","pending_customer","approved","on_hold","completed","cancelled"].map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select>
                <select className="tc-select" value={secondaryFilter} onChange={e=>setSecondaryFilter(e.target.value)}><option value="all">Todos los técnicos</option><option value="unassigned">Sin técnico</option>{data.technicians.map(item=><option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
              </div>
              <div className="tc-tablewrap tc-scroll">
                <table className="tc-table">
                  <thead><tr><th>Orden</th><th>Fecha y hora</th><th>Cliente</th><th>Equipo / falla</th><th>Dirección</th><th>Técnico</th><th>Estado</th><th style={{textAlign:"right"}}>Acciones</th></tr></thead>
                  <tbody>{orders.map(item=>{const customer=customersById.get(item.customer_id||"");const appt=appointmentsById.get(item.appointment_id||"");const tech=techniciansById.get(item.technician_id||"");return(
                    <tr key={item.id}>
                      <td className="tc-mono">{item.order_number}</td>
                      <td>{appt?localDate(appt.starts_at):"Sin cita"}</td>
                      <td><div className="tc-strong">{customer?.full_name||"Sin nombre"}</div><div className="tc-cell-sub">{customer?.phone||"Sin teléfono"}</div></td>
                      <td><div className="tc-truncate">{item.equipment||"Equipo"}</div><div className="tc-cell-sub tc-truncate">{item.issue||[item.brand,item.model].filter(Boolean).join(" · ")||"Sin detalle"}</div></td>
                      <td><div className="tc-truncate">{appt?.address||customer?.address||"Sin dirección"}</div></td>
                      <td>{tech?tech.full_name:<StatusBadge tone="warning">Sin técnico</StatusBadge>}</td>
                      <td><StatusBadge tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusBadge></td>
                      <td><div className="tc-rowactions">{can("update_order")&&<button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={()=>setModal({kind:"order",item})}>Gestionar</button>}{appt&&can("reschedule")&&<button type="button" className="tc-btn tc-btn-ghost tc-btn-sm" onClick={()=>setModal({kind:"appointment",item:appt})}>Cita</button>}</div></td>
                    </tr>
                  );})}</tbody>
                </table>
                {!orders.length&&<EmptyState title="Sin órdenes" message="No hay órdenes que coincidan con el filtro." icon={<ClipboardList size={20}/>} />}
              </div>
            </div>}

            {active==="Inventario"&&<InventoryPanel canEdit={can("edit_product")} />}

            {active==="Cotizaciones"&&<div className="tc-card">
              <div className="tc-card-head"><div><span className="tc-card-title-eyebrow">Comercial</span><h3>Cotizaciones</h3></div><StatusBadge tone="neutral" plain>{data.quotes.length} registros</StatusBadge></div>
              <div className="tc-tablewrap tc-scroll">
                <table className="tc-table">
                  <thead><tr><th>Cotización</th><th>Cliente</th><th className="tc-num">Total</th><th>Estado</th><th>Creada</th><th>Vence</th></tr></thead>
                  <tbody>{data.quotes.map(item=>(
                    <tr key={item.id}>
                      <td className="tc-mono">{item.quote_number}</td>
                      <td>{customersById.get(item.customer_id||"")?.full_name||"Sin nombre"}</td>
                      <td className="tc-num tc-strong">{money(item.total)}</td>
                      <td><StatusBadge tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusBadge></td>
                      <td>{localDate(item.created_at)}</td>
                      <td>{item.expires_at?localDate(item.expires_at):"—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {!data.quotes.length&&<EmptyState title="Sin cotizaciones" message="Aún no hay cotizaciones registradas." icon={<FileText size={20}/>} />}
              </div>
            </div>}

            {active==="Ventas"&&<div className="tc-card">
              <div className="tc-card-head"><div><span className="tc-card-title-eyebrow">Resultados</span><h3>Ventas</h3></div><StatusBadge tone="neutral" plain>{money(salesTotal)}</StatusBadge></div>
              <div className="tc-tablewrap tc-scroll">
                <table className="tc-table">
                  <thead><tr><th>Cliente</th><th>Producto</th><th className="tc-num">Cantidad</th><th className="tc-num">Monto</th><th>Origen</th><th>Estado</th><th>Fecha</th></tr></thead>
                  <tbody>{data.sales.map(item=>(
                    <tr key={item.id}>
                      <td className="tc-strong">{customersById.get(item.customer_id||"")?.full_name||"Sin nombre"}</td>
                      <td>{productsById.get(item.product_id||"")?.name||"—"}</td>
                      <td className="tc-num">{item.quantity}</td>
                      <td className="tc-num tc-strong">{money((item.unit_price||0)*(item.quantity||0))}</td>
                      <td><StatusBadge tone="info" plain>{item.source||"—"}</StatusBadge></td>
                      <td><StatusBadge tone={toneFor(item.status)}>{statusLabel(item.status)}</StatusBadge></td>
                      <td>{localDate(item.created_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {!data.sales.length&&<EmptyState title="Sin ventas" message="No hay ventas registradas." icon={<ShoppingCart size={20}/>} />}
              </div>
            </div>}
          </>)}
        </main>
      </div>

      <Drawer open={modal?.kind==="conversation"} onClose={closeOverlay} title={customersByPhone.get(cleanPhone(modal?.kind==="conversation"?modal.item.customer_phone:""))?.full_name||"Conversación"} eyebrow="Detalle de conversación" wide>
        {modal?.kind==="conversation"&&(conversationDetail?<>
          <div className="tc-metagrid">
            <div className="tc-metabox"><small>Canal</small><strong>{channel(modal.item)}</strong></div>
            <div className="tc-metabox"><small>Fecha</small><strong>{localDate(modal.item.created_at)}</strong></div>
            <div className="tc-metabox"><small>Teléfono</small><strong>{modal.item.customer_phone||"No disponible"}</strong></div>
            <div className="tc-metabox"><small>Estado</small><strong>{statusLabel(modal.item.status)}</strong></div>
          </div>
          <div className="tc-notice">{conversationDetail.event?.summary||modal.item.summary||"Sin resumen"}</div>
          {conversationDetail.audio_url?(audioRevealed?
            <div><small style={{display:"block",marginBottom:8,color:"var(--muted)",fontSize:12}}>Grabación conservada para fines regulatorios (INDOTEL)</small><AudioPlayer src={conversationDetail.audio_url} context={channel(modal.item)+" · "+(modal.item.customer_phone||"")} /></div>
            :<button type="button" className="tc-btn tc-btn-secondary" onClick={()=>setAudioRevealed(true)}><Volume2 size={16}/>Escuchar grabación</button>
          ):null}
          <div className={styles.transcript}>{conversationDetail.messages.length?conversationDetail.messages.map(msg=>(
            <div key={msg.id} className={`${styles.bubble} ${msg.role==="user"?styles.bubbleUser:""}`}><small>{msg.role==="user"?"Cliente":"Techcomm Assistant"} · {localDate(msg.created_at)}</small>{msg.content}</div>
          )):<EmptyState title="Sin transcripción" message="No hay mensajes detallados disponibles." icon={<MessagesSquare size={20}/>} />}</div>
        </>:<TableSkeleton rows={5} cols={1} />)}
      </Drawer>

      <Drawer open={modal?.kind==="history"} onClose={closeOverlay} title={modal?.kind==="history"?(modal.item.full_name||"Historial"):"Historial"} eyebrow="Historial del cliente">
        {modal?.kind==="history"&&(history.length?<div className={styles.timeline}>{history.map(item=>(
          <div className={styles.timelineItem} key={item.id}><time>{localDate(item.date)}</time><div><strong>{item.title}</strong><p>{item.detail}</p><small style={{color:"var(--muted-2)"}}>{item.type}</small></div></div>
        ))}</div>:<TableSkeleton rows={5} cols={1} />)}
      </Drawer>

      <Modal open={Boolean(editModal)} onClose={closeOverlay} title={modalTitle} eyebrow="Techcomm Operations">
        {editModal&&<form className="tc-form" onSubmit={saveModal}>
          {modal?.kind==="customer"&&<div className="tc-form-grid">
            <label>Nombre completo<input className="tc-input" name="full_name" defaultValue={modal.item.full_name||""} required/></label>
            <label>Teléfono<input className="tc-input" name="phone" defaultValue={modal.item.phone} required/></label>
            <label>Correo<input className="tc-input" name="email" defaultValue={modal.item.email||""}/></label>
            <label>Sector<input className="tc-input" name="sector" defaultValue={modal.item.sector||""}/></label>
            <label className="tc-full">Dirección<input className="tc-input" name="address" defaultValue={modal.item.address||""}/></label>
          </div>}
          {modal?.kind==="technician"&&<div className="tc-form-grid">
            <label>Nombre completo<input className="tc-input" name="full_name" defaultValue={modal.item.full_name} required/></label>
            <label>WhatsApp<input className="tc-input" name="phone" defaultValue={modal.item.phone||""} required/></label>
            <label>Especialidades<input className="tc-input" name="specialties" defaultValue={(modal.item.specialties||[]).join(", ")}/></label>
            <label>Zonas<input className="tc-input" name="zones" defaultValue={(modal.item.zones||[]).join(", ")}/></label>
            <label>Disponibilidad<select className="tc-select" name="status" defaultValue={modal.item.status}><option value="available">Disponible</option><option value="busy">Ocupado</option><option value="unavailable">No disponible</option></select></label>
            <label style={{alignSelf:"end"}}><span style={{display:"inline-flex",alignItems:"center",gap:8}}><input type="checkbox" name="whatsapp_enabled" defaultChecked={modal.item.whatsapp_enabled!==false}/> Notificaciones WhatsApp</span></label>
          </div>}
          {modal?.kind==="product"&&<div className="tc-form-grid">
            <label>SKU<input className="tc-input" name="sku" defaultValue={modal.item.sku||""}/></label>
            <label>Tipo<select className="tc-select" name="item_type" defaultValue={modal.item.item_type||"product"}><option value="equipment">Equipo</option><option value="product">Producto</option><option value="part">Pieza</option><option value="accessory">Accesorio</option></select></label>
            <label>Nombre<input className="tc-input" name="name" defaultValue={modal.item.name} required/></label>
            <label>Pieza<input className="tc-input" name="piece_name" defaultValue={modal.item.piece_name||""}/></label>
            <label>Marca<input className="tc-input" name="brand" defaultValue={modal.item.brand||""}/></label>
            <label>Modelo<input className="tc-input" name="model" defaultValue={modal.item.model||""}/></label>
            <label>Categoría<input className="tc-input" name="category" defaultValue={modal.item.category||""}/></label>
            <label>Precio de venta<input className="tc-input" type="number" name="sale_price" defaultValue={modal.item.sale_price??modal.item.price??0}/></label>
            <label>Costo unitario<input className="tc-input" type="number" name="unit_cost" defaultValue={modal.item.unit_cost||0}/></label>
            <label>Descuento máximo (%)<input className="tc-input" type="number" name="max_discount_pct" defaultValue={(modal.item.max_discount_pct||0)*100}/></label>
            <label>Stock total<input className="tc-input" type="number" name="stock" defaultValue={modal.item.stock}/></label>
            <label>Reservado<input className="tc-input" type="number" name="reserved_stock" defaultValue={modal.item.reserved_stock}/></label>
            <label>Instalación<input className="tc-input" type="number" name="installation_price" defaultValue={modal.item.installation_price||0}/></label>
            <label>Envío<input className="tc-input" type="number" name="delivery_price" defaultValue={modal.item.delivery_price||0}/></label>
            <label className="tc-full">Descripción<textarea className="tc-input tc-textarea" name="description" defaultValue={modal.item.description||""}/></label>
            <label className="tc-full" style={{flexDirection:"row"}}><span style={{display:"inline-flex",alignItems:"center",gap:8}}><input type="checkbox" name="installation_includes_delivery" defaultChecked={modal.item.installation_includes_delivery===true}/> La instalación incluye el envío</span></label>
          </div>}
          {modal?.kind==="appointment"&&<div className="tc-form-grid">
            <label>Fecha y hora<input className="tc-input" type="datetime-local" name="starts_at" defaultValue={toLocalInput(modal.item.starts_at)} required/></label>
            <label>Estado<select className="tc-select" name="status" defaultValue={modal.item.status}><option value="scheduled">Programada</option><option value="confirmed">Confirmada</option><option value="rescheduled">Reprogramada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></label>
            <label className="tc-full">Técnico<select className="tc-select" name="technician_id" defaultValue={modal.item.technician_id||""}><option value="">Sin técnico</option>{data.technicians.map(item=><option key={item.id} value={item.id}>{item.full_name} · {statusLabel(item.status)}</option>)}</select></label>
            <div className="tc-notice tc-full"><CalendarClock size={16}/><span>Al reprogramar, la prueba de confirmación telefónica quedará en cola para 2 minutos después de la hora de la visita.</span></div>
          </div>}
          {modal?.kind==="order"&&<div className="tc-form-grid">
            <label>Estado<select className="tc-select" name="status" defaultValue={modal.item.status}>{["new","scheduled","assigned","in_progress","pending_customer","approved","on_hold","completed","cancelled"].map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
            <label>Prioridad<select className="tc-select" name="priority" defaultValue={modal.item.priority||"normal"}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
            <label className="tc-full">Técnico<select className="tc-select" name="technician_id" defaultValue={modal.item.technician_id||""}><option value="">Sin técnico</option>{data.technicians.map(item=><option key={item.id} value={item.id}>{item.full_name} · {statusLabel(item.status)}</option>)}</select></label>
          </div>}
          {modal?.kind==="manual"&&<ManualFields customers={data.customers} technicians={data.technicians}/>}
          <div className="tc-form-actions"><button type="button" className="tc-btn tc-btn-ghost" onClick={closeOverlay}>Cancelar</button><button type="submit" className="tc-btn">Guardar</button></div>
        </form>}
      </Modal>
    </div>
  );
}

function SectionCard({ eyebrow, title, onOpen, children }:{ eyebrow:string; title:string; onOpen?:()=>void; children:React.ReactNode }){
  return (
    <section className="tc-card">
      <div className="tc-card-head">
        <div><span className="tc-card-title-eyebrow">{eyebrow}</span><h3>{title}</h3></div>
        {onOpen&&<button type="button" className="tc-btn tc-btn-ghost tc-btn-sm" onClick={onOpen}>Abrir<ArrowRight size={15}/></button>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function ManualFields({customers,technicians}:{customers:Customer[];technicians:Technician[]}){
  const [action,setAction]=useState("customer");
  return <>
    <label>Tipo de gestión<select className="tc-select" name="action" value={action} onChange={event=>setAction(event.target.value)}><option value="customer">Registrar o actualizar cliente</option><option value="appointment">Crear cita</option><option value="order">Crear orden presencial</option></select></label>
    <label>Cliente existente<select className="tc-select" name="customer_id"><option value="">Crear o localizar por teléfono</option>{customers.map(item=><option key={item.id} value={item.id}>{item.full_name||"Sin nombre"} · {item.phone}</option>)}</select></label>
    <div className="tc-form-grid"><label>Nombre completo<input className="tc-input" name="customer_name"/></label><label>Teléfono<input className="tc-input" name="phone"/></label><label>Correo<input className="tc-input" name="email"/></label><label>Sector<input className="tc-input" name="sector"/></label><label className="tc-full">Dirección<input className="tc-input" name="address"/></label></div>
    {action==="appointment"&&<div className="tc-form-grid"><label>Fecha y hora<input className="tc-input" type="datetime-local" name="starts_at" required/></label><label>Técnico<select className="tc-select" name="technician_id"><option value="">Sin asignar</option>{technicians.map(item=><option key={item.id} value={item.id}>{item.full_name} · {statusLabel(item.status)}</option>)}</select></label><label className="tc-full">Servicio / notas<input className="tc-input" name="notes" required/></label></div>}
    {action==="order"&&<div className="tc-form-grid"><label>Equipo<input className="tc-input" name="equipment" required/></label><label>Marca<input className="tc-input" name="brand"/></label><label>Modelo<input className="tc-input" name="model"/></label><label>Prioridad<select className="tc-select" name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label className="tc-full">Falla o solicitud<textarea className="tc-input tc-textarea" name="issue" required/></label><label className="tc-full">Técnico<select className="tc-select" name="technician_id"><option value="">Sin asignar</option>{technicians.map(item=><option key={item.id} value={item.id}>{item.full_name} · {statusLabel(item.status)}</option>)}</select></label></div>}
  </>;
}
