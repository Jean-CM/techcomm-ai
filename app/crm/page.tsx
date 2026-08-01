"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./crm.module.css";

type ManagementType = "Cliente" | "Producto" | "Cita" | "Orden" | "Cotización" | "Venta" | "Técnico";
type Customer = { id: string; full_name: string; phone: string; address?: string | null; source?: string | null };
type Product = { id: string; sku: string; name: string; piece_name?: string | null; description?: string | null; category?: string | null; brand?: string | null; model?: string | null; sale_price?: number | null; price?: number | null; minimum_authorized_price?: number | null; stock: number; reserved_stock: number };
type Technician = { id: string; full_name: string; phone?: string | null; specialties?: string[] | null; status: string; whatsapp_enabled?: boolean };
type Appointment = { id: string; customer_id?: string | null; technician_id?: string | null; starts_at: string; status: string; technician_confirmation_status?: string | null; notes?: string | null };
type WorkOrder = { id: string; order_number: string; customer_id?: string | null; equipment?: string | null; issue?: string | null; status: string };
type Quote = { id: string; quote_number: string; customer_id?: string | null; status: string; total?: number | null };
type Sale = { id: string; customer_id?: string | null; quantity: number; unit_price: number; status: string };
type CallEvent = { id: string; conversation_id: string; customer_phone?: string | null; status?: string | null; summary?: string | null; created_at: string };
type Overview = { ok: boolean; customers: Customer[]; products: Product[]; technicians: Technician[]; appointments: Appointment[]; work_orders: WorkOrder[]; quotes: Quote[]; sales: Sale[]; call_events: CallEvent[] };

const emptyOverview: Overview = { ok: true, customers: [], products: [], technicians: [], appointments: [], work_orders: [], quotes: [], sales: [], call_events: [] };
const menu = ["Dashboard", "Conversaciones", "Clientes", "Agenda", "Técnicos", "Órdenes", "Ventas", "Productos", "Cotizaciones"];

function money(value?: number | null) {
  if (value === null || value === undefined) return "Por confirmar";
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 }).format(value);
}
function statusLabel(value?: string | null) {
  const labels: Record<string, string> = { available: "Disponible", busy: "Ocupado", unavailable: "No disponible", done: "Completada", scheduled: "Programada", confirmed: "Confirmada", pending: "Pendiente", new: "Nueva" };
  return value ? labels[value] ?? value : "Pendiente";
}
function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const values: string[] = []; let current = ""; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(current.trim()); current = ""; }
      else current += char;
    }
    values.push(current.trim()); return values;
  };
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const headers = split(lines[0]).map(normalize);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, split(line)[index] ?? ""])));
}

export default function CrmPage() {
  const [active, setActive] = useState("Dashboard");
  const [data, setData] = useState<Overview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [managementType, setManagementType] = useState<ManagementType>("Cliente");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/crm/overview", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? payload.errors?.join(", ") ?? "No fue posible cargar el CRM.");
      setData(payload);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error al cargar el CRM."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const customersById = useMemo(() => new Map(data.customers.map((item) => [item.id, item])), [data.customers]);
  const customersByPhone = useMemo(() => new Map(data.customers.map((item) => [item.phone.replace(/\D/g, ""), item])), [data.customers]);
  const techniciansById = useMemo(() => new Map(data.technicians.map((item) => [item.id, item])), [data.technicians]);
  const today = new Date().toISOString().slice(0, 10);
  const appointmentsToday = data.appointments.filter((item) => item.starts_at?.startsWith(today)).length;
  const lowStock = data.products.filter((item) => Math.max(0, item.stock - item.reserved_stock) <= 2).length;

  async function submitManagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("Guardando...");
    const response = await fetch("/api/crm/manage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: managementType, name: form.get("name"), detail: form.get("detail"), secondary: form.get("secondary") }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "No fue posible guardar."); return; }
    setModalOpen(false); setMessage(`${managementType} registrado correctamente.`); event.currentTarget.reset(); await load();
  }

  async function importCatalog(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setMessage(`Procesando ${file.name}...`);
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const rows = parseCsv(await file.text());
        if (!rows.length) throw new Error("El archivo no contiene filas válidas.");
        const response = await fetch("/api/crm/import-catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows, source: file.name }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "No fue posible importar.");
        setMessage(`Importación completada: ${payload.imported} registros; ${payload.rejected ?? 0} rechazados.`); await load(); return;
      }
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/crm/import-file", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No fue posible importar el archivo.");
      setMessage(`Importación completada: ${payload.imported} registros; ${payload.rejected ?? 0} rechazados.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error al importar."); }
  }

  async function updateTechnicianStatus(technicianId: string, status: string) {
    setMessage("Actualizando técnico...");
    const response = await fetch("/api/crm/technicians/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ technician_id: technicianId, status }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "No fue posible actualizar el estado."); return; }
    setMessage("Estado del técnico actualizado."); await load();
  }

  const labels: Record<ManagementType, [string, string, string]> = {
    Cliente: ["Nombre completo", "Teléfono", "Dirección o sector"], Producto: ["Nombre o pieza", "Categoría", "Marca o modelo"], Cita: ["Nombre del cliente", "Servicio", "Fecha y hora"], Orden: ["Nombre del cliente", "Falla", "Equipo"], Cotización: ["Nombre del cliente", "Concepto", "Monto"], Venta: ["Nombre del cliente", "Producto", "Monto"], Técnico: ["Nombre completo", "Número de WhatsApp", "Especialidades separadas por coma"],
  };
  const empty = (text: string) => <div className={styles.placeholder}><p>{text}</p></div>;

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.identity}><img src="https://www.techcommwireless.com/images/logo-2.png" alt="Techcomm Wireless" onError={(event) => { event.currentTarget.style.display = "none"; }} /><div><h2>Techcomm <span>Operations</span></h2><p>Operación omnicanal</p></div></div>
      <nav>{menu.map((item) => <button className={active === item ? styles.active : ""} key={item} onClick={() => setActive(item)}>{item}</button>)}</nav>
      <div className={styles.channelStatus}><span /> Supabase conectado<br/><span /> WhatsApp y voz activos</div>
    </aside>

    <section className={styles.content}>
      <header className={styles.header}><div><small>TECHCOMM OPERATIONS</small><h1>{active}</h1></div><div className={styles.headerActions}><button onClick={() => { setManagementType("Cliente"); setModalOpen(true); }}>+ Nueva gestión</button><div className={styles.avatar}>JC</div></div></header>
      {message && <section className={styles.notice}>{message}</section>}
      {loading && empty("Cargando datos reales desde Supabase...")}

      {!loading && active === "Dashboard" && <><div className={styles.metrics}><article><small>Conversaciones</small><strong>{data.call_events.length}</strong><span>Registros procesados</span></article><article><small>Citas de hoy</small><strong>{appointmentsToday}</strong><span>{data.appointments.length} en agenda</span></article><article><small>Órdenes activas</small><strong>{data.work_orders.filter((item) => !["completed","cancelled"].includes(item.status)).length}</strong><span>{data.work_orders.length} totales</span></article><article><small>Alertas</small><strong>{lowStock}</strong><span>Stock bajo</span></article></div><div className={styles.gridTwo}><section className={styles.card}><div className={styles.cardTitle}><div><small>ACTIVIDAD RECIENTE</small><h3>Conversaciones</h3></div><button onClick={() => setActive("Conversaciones")}>Ver todas</button></div>{data.call_events.length ? data.call_events.slice(0,4).map((item) => { const phone=(item.customer_phone||"").replace(/\D/g,""); const customer=customersByPhone.get(phone); return <div className={styles.conversation} key={item.id}><div className={styles.channel}>☎</div><div><strong>{customer?.full_name||item.customer_phone||"Contacto sin identificar"}</strong><p>{item.summary||"Sin resumen"}</p></div><div><span>{statusLabel(item.status)}</span><small>{new Date(item.created_at).toLocaleString("es-DO")}</small></div></div>; }) : empty("No hay conversaciones registradas.")}</section><section className={styles.card}><div className={styles.cardTitle}><div><small>PRÓXIMAS VISITAS</small><h3>Agenda</h3></div><button onClick={() => setActive("Agenda")}>Abrir</button></div>{data.appointments.length ? data.appointments.slice(0,4).map((item)=><div className={styles.scheduleRow} key={item.id}><div><strong>{new Date(item.starts_at).toLocaleString("es-DO")}</strong><p>{customersById.get(item.customer_id||"")?.full_name||"Cliente sin vincular"} · {item.notes||"Servicio"}</p></div><span>{techniciansById.get(item.technician_id||"")?.full_name||"Sin técnico"}</span><span>{statusLabel(item.technician_confirmation_status||item.status)}</span></div>) : empty("No hay citas registradas.")}</section></div></>}

      {!loading && active === "Conversaciones" && <section className={styles.card}><div className={styles.cardTitle}><div><small>HISTORIAL</small><h3>Llamadas y conversaciones</h3></div></div>{data.call_events.length ? data.call_events.map((item)=>{const phone=(item.customer_phone||"").replace(/\D/g,"");const customer=customersByPhone.get(phone);return <div className={styles.conversation} key={item.id}><div className={styles.channel}>☎</div><div><strong>{customer?.full_name||item.customer_phone||"Contacto sin identificar"}</strong><p>{item.summary||"Sin resumen"}</p></div><div><span>{statusLabel(item.status)}</span><small>{new Date(item.created_at).toLocaleString("es-DO")}</small></div></div>;}) : empty("No hay conversaciones registradas.")}</section>}
      {!loading && active === "Clientes" && <section className={styles.card}><div className={styles.cardTitle}><div><small>BASE PROPIA</small><h3>Clientes</h3></div><button onClick={()=>{setManagementType("Cliente");setModalOpen(true);}}>+ Registrar</button></div>{data.customers.length ? data.customers.map((item)=><div className={styles.dataRow} key={item.id}><strong>{item.full_name}</strong><span>{item.phone}</span><span>{item.address||"Sin dirección"}</span><span>{item.source||"crm"}</span></div>) : empty("Se llenará con WhatsApp, llamadas y atención presencial.")}</section>}
      {!loading && active === "Productos" && <section className={styles.card}><div className={styles.cardTitle}><div><small>INVENTARIO</small><h3>Productos, equipos y piezas</h3></div><div className={styles.actions}><label className={styles.importButton}>Importar XLSX/CSV<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={importCatalog}/></label><button onClick={()=>{setManagementType("Producto");setModalOpen(true);}}>+ Registrar</button></div></div>{data.products.length ? data.products.map((item)=><div className={styles.product} key={item.id}><div><strong>{item.piece_name||item.name}</strong><small>{item.category||"General"} · {item.brand||"Sin marca"} · {item.model||"Sin modelo"}</small><p>{item.description||"Sin descripción"}</p></div><div><b>{money(item.sale_price??item.price)}</b><span>Mínimo: {money(item.minimum_authorized_price)} · Disponible: {Math.max(0,item.stock-item.reserved_stock)}</span></div></div>) : empty("El catálogo está vacío. Importa el archivo aprobado por el socio.")}</section>}
      {!loading && active === "Técnicos" && <section className={styles.card}><div className={styles.cardTitle}><div><small>EQUIPO DE CAMPO</small><h3>Técnicos</h3></div><button onClick={()=>{setManagementType("Técnico");setModalOpen(true);}}>+ Agregar técnico</button></div>{data.technicians.length ? data.technicians.map((item)=><div className={styles.technicianRow} key={item.id}><div><strong>{item.full_name}</strong><p>{item.phone||"Sin WhatsApp"} · {(item.specialties||[]).join(", ")||"Sin especialidad"}</p></div><select aria-label={`Estado de ${item.full_name}`} value={item.status} onChange={(event)=>void updateTechnicianStatus(item.id,event.target.value)}><option value="available">Disponible</option><option value="busy">Ocupado</option><option value="unavailable">No disponible</option></select><span>{item.whatsapp_enabled?"WhatsApp activo":"Sin WhatsApp"}</span></div>) : empty("No hay técnicos registrados.")}</section>}
      {!loading && active === "Agenda" && <section className={styles.card}><div className={styles.cardTitle}><div><small>AGENDA</small><h3>Citas</h3></div><button onClick={()=>{setManagementType("Cita");setModalOpen(true);}}>+ Crear cita</button></div>{data.appointments.length ? data.appointments.map((item)=><div className={styles.scheduleRow} key={item.id}><div><strong>{new Date(item.starts_at).toLocaleString("es-DO")}</strong><p>{customersById.get(item.customer_id||"")?.full_name||"Cliente sin vincular"} · {item.notes||"Servicio"}</p></div><span>{techniciansById.get(item.technician_id||"")?.full_name||"Sin técnico"}</span><span>{statusLabel(item.technician_confirmation_status||item.status)}</span></div>) : empty("No hay citas registradas.")}</section>}
      {!loading && active === "Órdenes" && <section className={styles.card}><div className={styles.cardTitle}><div><small>SERVICIO</small><h3>Órdenes</h3></div><button onClick={()=>{setManagementType("Orden");setModalOpen(true);}}>+ Crear orden</button></div>{data.work_orders.length ? data.work_orders.map((item)=><div className={styles.dataRow} key={item.id}><strong>{item.order_number}</strong><span>{customersById.get(item.customer_id||"")?.full_name||"Cliente"}</span><span>{item.equipment||"Equipo"}: {item.issue||"Sin falla"}</span><span>{statusLabel(item.status)}</span></div>) : empty("No hay órdenes registradas.")}</section>}
      {!loading && active === "Cotizaciones" && <section className={styles.card}><div className={styles.cardTitle}><div><small>COMERCIAL</small><h3>Cotizaciones</h3></div><button onClick={()=>{setManagementType("Cotización");setModalOpen(true);}}>+ Crear</button></div>{data.quotes.length ? data.quotes.map((item)=><div className={styles.dataRow} key={item.id}><strong>{item.quote_number}</strong><span>{customersById.get(item.customer_id||"")?.full_name||"Cliente"}</span><span>{money(item.total)}</span><span>{statusLabel(item.status)}</span></div>) : empty("No hay cotizaciones registradas.")}</section>}
      {!loading && active === "Ventas" && <section className={styles.card}><div className={styles.cardTitle}><div><small>COMERCIAL</small><h3>Ventas</h3></div><button onClick={()=>{setManagementType("Venta");setModalOpen(true);}}>+ Registrar</button></div>{data.sales.length ? data.sales.map((item)=><div className={styles.dataRow} key={item.id}><strong>{customersById.get(item.customer_id||"")?.full_name||"Cliente"}</strong><span>{item.quantity} unidad(es)</span><span>{money(item.unit_price)}</span><span>{statusLabel(item.status)}</span></div>) : empty("No hay ventas registradas.")}</section>}

      {modalOpen && <div className={styles.modalBackdrop}><section className={styles.modal}><div className={styles.modalHeader}><div><small>NUEVA GESTIÓN</small><h3>{managementType}</h3></div><button onClick={()=>setModalOpen(false)}>×</button></div><div className={styles.typeGrid}>{(["Cliente","Producto","Cita","Orden","Cotización","Venta","Técnico"] as ManagementType[]).map((item)=><button type="button" className={managementType===item?styles.selectedType:""} key={item} onClick={()=>setManagementType(item)}>{item}</button>)}</div><form className={styles.managementForm} onSubmit={submitManagement}><label>{labels[managementType][0]}<input name="name" required/></label><label>{labels[managementType][1]}<input name="detail" required={managementType==="Técnico"||managementType==="Cliente"}/></label><label>{labels[managementType][2]}<input name="secondary" type={managementType==="Cita"?"datetime-local":"text"}/></label><div className={styles.formActions}><button type="button" onClick={()=>setModalOpen(false)}>Cancelar</button><button type="submit">Guardar en Supabase</button></div></form></section></div>}
    </section>
  </main>;
}
