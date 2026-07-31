"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./crm.module.css";

type ManagementType = "Cliente" | "Producto" | "Cita" | "Orden" | "Cotización" | "Venta" | "Técnico";
type Customer = { id: string; full_name: string; phone: string; address?: string | null; source?: string | null };
type Product = { id: string; sku: string; name: string; piece_name?: string | null; description?: string | null; category?: string | null; brand?: string | null; model?: string | null; unit_cost?: number | null; sale_price?: number | null; price?: number | null; max_discount_pct?: number | null; minimum_authorized_price?: number | null; stock: number; reserved_stock: number };
type Technician = { id: string; full_name: string; phone?: string | null; specialties?: string[] | null; status: string; whatsapp_enabled?: boolean };
type Appointment = { id: string; customer_id?: string | null; technician_id?: string | null; starts_at: string; address?: string | null; status: string; technician_confirmation_status?: string | null; notes?: string | null };
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al cargar el CRM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const customersById = useMemo(() => new Map(data.customers.map((item) => [item.id, item])), [data.customers]);
  const techniciansById = useMemo(() => new Map(data.technicians.map((item) => [item.id, item])), [data.technicians]);
  const available = data.technicians.filter((item) => item.status === "available").length;

  async function submitManagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("Guardando...");
    const response = await fetch("/api/crm/manage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: managementType, name: form.get("name"), detail: form.get("detail"), secondary: form.get("secondary") }),
    });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "No fue posible guardar."); return; }
    setModalOpen(false);
    setMessage(`${managementType} registrado correctamente.`);
    event.currentTarget.reset();
    await load();
  }

  async function importCatalog(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setMessage(`Importando ${file.name}...`);
    const response = await fetch("/api/crm/import", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "No fue posible importar."); return; }
    setMessage(`Importación completada: ${payload.imported} registros procesados.`);
    await load();
  }

  const labels: Record<ManagementType, [string, string, string]> = {
    Cliente: ["Nombre completo", "Teléfono", "Dirección o sector"],
    Producto: ["Nombre o pieza", "Categoría", "Marca o modelo"],
    Cita: ["Nombre del cliente", "Servicio", "Fecha y hora"],
    Orden: ["Nombre del cliente", "Falla", "Equipo"],
    Cotización: ["Nombre del cliente", "Concepto", "Monto"],
    Venta: ["Nombre del cliente", "Producto", "Monto"],
    Técnico: ["Nombre completo", "Teléfono WhatsApp", "Especialidades separadas por coma"],
  };
  const empty = (text: string) => <div className={styles.placeholder}><p>{text}</p></div>;

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div><span className={styles.brand}>TECHCOMM AI</span><h2>Techcomm Operations</h2><p>Centro de operaciones omnicanal</p></div>
      <nav>{menu.map((item) => <button className={active === item ? styles.active : ""} key={item} onClick={() => setActive(item)}>{item}</button>)}</nav>
      <div className={styles.channelStatus}><span /> Datos en Supabase<br/><span /> WhatsApp y voz conectados</div>
    </aside>
    <section className={styles.content}>
      <header className={styles.header}><div><small>OPERACIÓN EN TIEMPO REAL</small><h1>{active}</h1></div><div className={styles.headerActions}><button onClick={() => { setManagementType("Cliente"); setModalOpen(true); }}>+ Nueva gestión</button><div className={styles.avatar}>JC</div></div></header>
      {message && <section className={styles.card} style={{ marginBottom: 16, padding: 12 }}>{message}</section>}
      {loading && empty("Cargando información desde Supabase...")}

      {!loading && active === "Dashboard" && <>
        <div className={styles.metrics}>
          <article><small>Llamadas registradas</small><strong>{data.call_events.length}</strong><span>ElevenLabs + Supabase</span></article>
          <article><small>Citas</small><strong>{data.appointments.length}</strong><span>Agenda real</span></article>
          <article><small>Órdenes</small><strong>{data.work_orders.length}</strong><span>RD$500 por visita</span></article>
          <article><small>Técnicos disponibles</small><strong>{available}</strong><span>{data.technicians.length} registrados</span></article>
        </div>
        <div className={styles.gridTwo}>
          <section className={styles.card}><div className={styles.cardTitle}><div><small>CONVERSACIONES</small><h3>Llamadas recientes</h3></div><button onClick={() => setActive("Conversaciones")}>Ver todas</button></div>{data.call_events.length ? data.call_events.slice(0,4).map((item) => <div className={styles.conversation} key={item.id}><div className={styles.channel}>☎</div><div><strong>{item.customer_phone || "Contacto sin identificar"}</strong><p>{item.summary || "Sin resumen"}</p></div><div><span>{item.status || "procesada"}</span><small>{new Date(item.created_at).toLocaleString("es-DO")}</small></div></div>) : empty("Aún no hay llamadas registradas.")}</section>
          <section className={styles.card}><div className={styles.cardTitle}><div><small>INVENTARIO</small><h3>Productos y piezas</h3></div><button onClick={() => setActive("Productos")}>Abrir catálogo</button></div>{data.products.length ? data.products.slice(0,4).map((item) => <div className={styles.product} key={item.id}><div><strong>{item.piece_name || item.name}</strong><small>{item.brand || "Sin marca"} · {item.model || "Sin modelo"}</small></div><div><b>{money(item.sale_price ?? item.price)}</b><span>{Math.max(0,item.stock-item.reserved_stock)} disponibles</span></div></div>) : empty("Importa el catálogo para comenzar.")}</section>
        </div>
      </>}

      {!loading && active === "Conversaciones" && <section className={styles.card}><div className={styles.cardTitle}><div><small>ELEVENLABS + SUPABASE</small><h3>Llamadas registradas</h3></div></div>{data.call_events.length ? data.call_events.map((item) => <div className={styles.conversation} key={item.id}><div className={styles.channel}>☎</div><div><strong>{item.customer_phone || item.conversation_id}</strong><p>{item.summary || "Sin resumen disponible"}</p></div><div><span>{item.status || "done"}</span><small>{new Date(item.created_at).toLocaleString("es-DO")}</small></div></div>) : empty("No hay conversaciones registradas.")}</section>}
      {!loading && active === "Clientes" && <section className={styles.card}><div className={styles.cardTitle}><div><small>BASE PROPIA</small><h3>Clientes creados por nuevas gestiones</h3></div><button onClick={() => { setManagementType("Cliente"); setModalOpen(true); }}>+ Registrar cliente</button></div>{data.customers.length ? data.customers.map((item) => <div className={styles.dataRow} key={item.id}><strong>{item.full_name}</strong><span>{item.phone}</span><span>{item.address || "Sin dirección"}</span><span>{item.source || "crm"}</span></div>) : empty("La base está vacía. Se llenará con WhatsApp, llamadas y atención presencial.")}</section>}
      {!loading && active === "Productos" && <section className={styles.card}><div className={styles.cardTitle}><div><small>CATÁLOGO CONTROLADO</small><h3>Productos, equipos y piezas</h3></div><div style={{display:"flex",gap:8}}><label className={styles.importButton}>Importar XLSX/CSV<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={importCatalog}/></label><button onClick={() => { setManagementType("Producto"); setModalOpen(true); }}>+ Registrar</button></div></div>{data.products.length ? data.products.map((item) => <div className={styles.product} key={item.id}><div><strong>{item.piece_name || item.name}</strong><small>{item.category || "General"} · {item.brand || "Sin marca"} · {item.model || "Sin modelo"}</small><p>{item.description || "Sin descripción"}</p></div><div><b>{money(item.sale_price ?? item.price)}</b><span>Mínimo: {money(item.minimum_authorized_price)} · Stock: {Math.max(0,item.stock-item.reserved_stock)}</span></div></div>) : empty("No hay catálogo. Usa Importar XLSX/CSV o Registrar.")}</section>}
      {!loading && active === "Técnicos" && <section className={styles.card}><div className={styles.cardTitle}><div><small>EQUIPO DE CAMPO</small><h3>Técnicos y WhatsApp</h3></div><button onClick={() => { setManagementType("Técnico"); setModalOpen(true); }}>+ Agregar técnico</button></div>{data.technicians.length ? data.technicians.map((item) => <div className={styles.technicianRow} key={item.id}><div><strong>{item.full_name}</strong><p>{item.phone || "Sin teléfono"} · {(item.specialties || []).join(", ") || "Sin especialidad"}</p></div><span>{item.status}</span><span>{item.whatsapp_enabled ? "WhatsApp activo" : "Sin WhatsApp"}</span></div>) : empty("No hay técnicos registrados. Usa Agregar técnico.")}</section>}
      {!loading && active === "Agenda" && <section className={styles.card}><div className={styles.cardTitle}><div><small>AGENDA</small><h3>Citas reales</h3></div><button onClick={() => { setManagementType("Cita"); setModalOpen(true); }}>+ Crear cita</button></div>{data.appointments.length ? data.appointments.map((item) => <div className={styles.scheduleRow} key={item.id}><div><strong>{new Date(item.starts_at).toLocaleString("es-DO")}</strong><p>{item.notes || "Servicio"} · {item.address || "Sin dirección"}</p></div><span>{techniciansById.get(item.technician_id || "")?.full_name || "Sin técnico"}</span><span>{item.technician_confirmation_status || item.status}</span></div>) : empty("No hay citas registradas.")}</section>}
      {!loading && active === "Órdenes" && <section className={styles.card}><div className={styles.cardTitle}><div><small>SERVICIO TÉCNICO</small><h3>Órdenes reales</h3></div><button onClick={() => { setManagementType("Orden"); setModalOpen(true); }}>+ Crear orden</button></div>{data.work_orders.length ? data.work_orders.map((item) => <div className={styles.dataRow} key={item.id}><strong>{item.order_number}</strong><span>{customersById.get(item.customer_id || "")?.full_name || "Cliente no vinculado"}</span><span>{item.equipment || "Equipo"}: {item.issue || "Sin falla"}</span><span>{item.status}</span></div>) : empty("No hay órdenes registradas.")}</section>}
      {!loading && active === "Cotizaciones" && <section className={styles.card}><div className={styles.cardTitle}><div><small>COMERCIAL</small><h3>Cotizaciones</h3></div><button onClick={() => { setManagementType("Cotización"); setModalOpen(true); }}>+ Crear cotización</button></div>{data.quotes.length ? data.quotes.map((item) => <div className={styles.dataRow} key={item.id}><strong>{item.quote_number}</strong><span>{customersById.get(item.customer_id || "")?.full_name || "Cliente"}</span><span>{money(item.total)}</span><span>{item.status}</span></div>) : empty("No hay cotizaciones registradas.")}</section>}
      {!loading && active === "Ventas" && <section className={styles.card}><div className={styles.cardTitle}><div><small>VENTAS</small><h3>Oportunidades y ventas</h3></div><button onClick={() => { setManagementType("Venta"); setModalOpen(true); }}>+ Registrar venta</button></div>{data.sales.length ? data.sales.map((item) => <div className={styles.dataRow} key={item.id}><strong>{customersById.get(item.customer_id || "")?.full_name || "Cliente"}</strong><span>{item.quantity} unidad(es)</span><span>{money(item.unit_price)}</span><span>{item.status}</span></div>) : empty("No hay ventas registradas.")}</section>}

      {modalOpen && <div className={styles.modalBackdrop}><section className={styles.modal}><div className={styles.modalHeader}><div><small>NUEVA GESTIÓN</small><h3>{managementType}</h3></div><button onClick={() => setModalOpen(false)}>×</button></div><div className={styles.typeGrid}>{(["Cliente","Producto","Cita","Orden","Cotización","Venta","Técnico"] as ManagementType[]).map((item) => <button type="button" className={managementType===item?styles.selectedType:""} key={item} onClick={() => setManagementType(item)}>{item}</button>)}</div><form className={styles.managementForm} onSubmit={submitManagement}><label>{labels[managementType][0]}<input name="name" required/></label><label>{labels[managementType][1]}<input name="detail"/></label><label>{labels[managementType][2]}<input name="secondary" type={managementType==="Cita"?"datetime-local":"text"}/></label><div className={styles.formActions}><button type="button" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit">Guardar en Supabase</button></div></form></section></div>}
    </section>
  </main>;
}
