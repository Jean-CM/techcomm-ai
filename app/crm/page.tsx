"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./crm.module.css";

type Technician = { id: string; name: string; status: "Disponible" | "Ocupado" | "No disponible"; specialty: string };
type Appointment = { id: string; time: string; customer: string; service: string; zone: string; technicianId: string; status: string };
type Customer = { id: string; name: string; phone: string; address: string; source: string };
type Product = { id: string; name: string; category: string; brand: string; stock: number; reserved: number; price: string };
type WorkOrder = { id: string; customer: string; equipment: string; issue: string; status: string; technician: string };
type Quote = { id: string; customer: string; concept: string; total: string; status: string };
type Sale = { id: string; customer: string; product: string; amount: string; status: string };
type ManagementType = "Cliente" | "Producto" | "Cita" | "Orden" | "Cotización" | "Venta";

const techniciansSeed: Technician[] = [
  { id: "t1", name: "Luis Pérez", status: "Disponible", specialty: "TV y audio" },
  { id: "t2", name: "Carlos Méndez", status: "Ocupado", specialty: "Neveras y lavadoras" },
  { id: "t3", name: "Ana Rodríguez", status: "Disponible", specialty: "Celulares y laptops" },
  { id: "t4", name: "Miguel Santos", status: "No disponible", specialty: "Electrodomésticos" },
];

const appointmentsSeed: Appointment[] = [
  { id: "C-1042", time: "10:00 a. m.", customer: "Jean Carlos Mateo", service: "Nevera LG no enfría", zone: "Villa Mella", technicianId: "t2", status: "Confirmada" },
  { id: "C-1043", time: "11:30 a. m.", customer: "Rosa Martínez", service: "TV Samsung sin imagen", zone: "Santo Domingo Este", technicianId: "t1", status: "Pendiente" },
  { id: "C-1044", time: "2:00 p. m.", customer: "Pedro Gómez", service: "Laptop no enciende", zone: "Los Prados", technicianId: "t3", status: "Confirmada" },
];

const conversations = [
  { channel: "WhatsApp", customer: "Jean Carlos Mateo", text: "Mi nevera dejó de enfriar", intent: "Reparación", time: "Ahora" },
  { channel: "WhatsApp", customer: "Laura Díaz", text: "¿Tienen iPhone 15 disponible?", intent: "Venta", time: "Hace 4 min" },
  { channel: "Llamada", customer: "Rosa Martínez", text: "Confirmó visita técnica", intent: "Confirmación", time: "Hace 12 min" },
];

export default function CrmPage() {
  const [active, setActive] = useState("Dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [managementType, setManagementType] = useState<ManagementType>("Cliente");
  const [technicians, setTechnicians] = useState(techniciansSeed);
  const [appointments, setAppointments] = useState(appointmentsSeed);
  const [customers, setCustomers] = useState<Customer[]>([
    { id: "CL-1001", name: "Jean Carlos Mateo", phone: "829-524-6242", address: "Villa Mella", source: "WhatsApp" },
    { id: "CL-1002", name: "Rosa Martínez", phone: "809-555-1488", address: "Santo Domingo Este", source: "Presencial" },
  ]);
  const [products, setProducts] = useState<Product[]>([
    { id: "PR-1001", name: "Cargador USB-C 25W", category: "Accesorios", brand: "Samsung", stock: 18, reserved: 3, price: "RD$ 1,650" },
    { id: "PR-1002", name: "Pantalla LCD de reemplazo", category: "Piezas", brand: "Compatible", stock: 8, reserved: 1, price: "Por confirmar" },
    { id: "PR-1003", name: "Batería para móvil", category: "Piezas", brand: "Compatible", stock: 12, reserved: 2, price: "Por confirmar" },
  ]);
  const [orders, setOrders] = useState<WorkOrder[]>([
    { id: "OT-057267", customer: "Jean Carlos Mateo", equipment: "Nevera LG", issue: "No enfría", status: "Agendada", technician: "Carlos Méndez" },
  ]);
  const [quotes, setQuotes] = useState<Quote[]>([
    { id: "CT-2001", customer: "Laura Díaz", concept: "Cargador USB-C", total: "RD$ 1,650", status: "Borrador" },
  ]);
  const [sales, setSales] = useState<Sale[]>([
    { id: "VT-3001", customer: "Laura Díaz", product: "Cargador USB-C 25W", amount: "RD$ 1,650", status: "Oportunidad" },
  ]);

  const available = useMemo(() => technicians.filter((item) => item.status === "Disponible").length, [technicians]);
  const nextId = (prefix: string, length: number) => `${prefix}-${String(length + 1).padStart(4, "0")}`;

  function reassign(appointmentId: string, technicianId: string) {
    setAppointments((current) => current.map((item) => item.id === appointmentId ? { ...item, technicianId } : item));
  }

  function toggleAvailability(technicianId: string) {
    setTechnicians((current) => current.map((item) => item.id === technicianId
      ? { ...item, status: item.status === "No disponible" ? "Disponible" : "No disponible" }
      : item));
  }

  function openManagement(type?: ManagementType) {
    if (type) setManagementType(type);
    setModalOpen(true);
  }

  function submitManagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const detail = String(form.get("detail") ?? "").trim();
    const secondary = String(form.get("secondary") ?? "").trim();

    if (!name) return;

    if (managementType === "Cliente") {
      setCustomers((current) => [{ id: nextId("CL", current.length), name, phone: detail || "Sin teléfono", address: secondary || "Sin dirección", source: "Presencial" }, ...current]);
      setActive("Clientes");
    }
    if (managementType === "Producto") {
      setProducts((current) => [{ id: nextId("PR", current.length), name, category: detail || "General", brand: secondary || "Sin marca", stock: 0, reserved: 0, price: "Por confirmar" }, ...current]);
      setActive("Productos");
    }
    if (managementType === "Cita") {
      setAppointments((current) => [{ id: nextId("C", current.length + 1040), time: secondary || "Por coordinar", customer: name, service: detail || "Servicio por definir", zone: "Pendiente", technicianId: technicians.find((item) => item.status === "Disponible")?.id ?? "t1", status: "Pendiente" }, ...current]);
      setActive("Agenda");
    }
    if (managementType === "Orden") {
      setOrders((current) => [{ id: nextId("OT", current.length + 57260), customer: name, equipment: secondary || "Equipo por identificar", issue: detail || "Pendiente de descripción", status: "Nueva", technician: "Sin asignar" }, ...current]);
      setActive("Órdenes");
    }
    if (managementType === "Cotización") {
      setQuotes((current) => [{ id: nextId("CT", current.length + 2000), customer: name, concept: detail || "Concepto por definir", total: secondary || "Por confirmar", status: "Borrador" }, ...current]);
      setActive("Cotizaciones");
    }
    if (managementType === "Venta") {
      setSales((current) => [{ id: nextId("VT", current.length + 3000), customer: name, product: detail || "Producto por definir", amount: secondary || "Por confirmar", status: "Oportunidad" }, ...current]);
      setActive("Ventas");
    }

    event.currentTarget.reset();
    setModalOpen(false);
  }

  const labelMap: Record<ManagementType, [string, string, string]> = {
    Cliente: ["Nombre completo", "Teléfono", "Dirección o sector"],
    Producto: ["Nombre del producto", "Categoría", "Marca o modelo"],
    Cita: ["Cliente", "Servicio solicitado", "Fecha y hora"],
    Orden: ["Cliente", "Falla reportada", "Equipo"],
    Cotización: ["Cliente", "Producto o servicio", "Monto estimado"],
    Venta: ["Cliente", "Producto", "Monto estimado"],
  };

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div><span className={styles.brand}>TECHCOMM AI</span><h2>Techcomm 360</h2><p>Centro de operaciones omnicanal</p></div>
        <nav>{["Dashboard","Conversaciones","Clientes","Agenda","Técnicos","Órdenes","Ventas","Productos","Cotizaciones"].map((item) => <button className={active === item ? styles.active : ""} key={item} onClick={() => setActive(item)}>{item}</button>)}</nav>
        <div className={styles.channelStatus}><span /> WhatsApp conectado<br/><span /> Agente de voz activo</div>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}><div><small>OPERACIÓN EN TIEMPO REAL</small><h1>{active}</h1></div><div className={styles.headerActions}><button onClick={() => openManagement()}>+ Nueva gestión</button><div className={styles.avatar}>JC</div></div></header>

        {active === "Dashboard" && <>
          <div className={styles.metrics}>
            <article><small>Conversaciones activas</small><strong>8</strong><span>5 WhatsApp · 3 web</span></article>
            <article><small>Citas de hoy</small><strong>{appointments.length}</strong><span>{appointments.filter((item) => item.status === "Confirmada").length} confirmadas</span></article>
            <article><small>Oportunidades de venta</small><strong>{sales.length}</strong><span>Seguimiento comercial activo</span></article>
            <article><small>Técnicos disponibles</small><strong>{available}</strong><span>Asignación operativa</span></article>
          </div>
          <div className={styles.gridTwo}>
            <section className={styles.card}><div className={styles.cardTitle}><div><small>BANDEJA OMNICANAL</small><h3>Conversaciones recientes</h3></div><button onClick={() => setActive("Conversaciones")}>Ver todas</button></div>{conversations.map((item) => <div className={styles.conversation} key={item.customer}><div className={styles.channel}>{item.channel === "WhatsApp" ? "W" : "☎"}</div><div><strong>{item.customer}</strong><p>{item.text}</p></div><div><span>{item.intent}</span><small>{item.time}</small></div></div>)}</section>
            <section className={styles.card}><div className={styles.cardTitle}><div><small>AGENDA INTELIGENTE</small><h3>Próximas visitas</h3></div><button onClick={() => setActive("Agenda")}>Abrir calendario</button></div>{appointments.slice(0,3).map((item) => { const tech = technicians.find((t) => t.id === item.technicianId); return <div className={styles.appointment} key={item.id}><div className={styles.time}>{item.time}</div><div><strong>{item.customer}</strong><p>{item.service} · {item.zone}</p><small>{item.id} · {item.status}</small></div><div className={styles.techBadge}>{tech?.name}<span>{tech?.status}</span></div></div>})}</section>
          </div>
          <div className={styles.gridTwo}>
            <section className={styles.card}><div className={styles.cardTitle}><div><small>VENTAS E INVENTARIO</small><h3>Productos registrados</h3></div><button onClick={() => setActive("Productos")}>Gestionar inventario</button></div>{products.slice(0,3).map((item) => <div className={styles.product} key={item.id}><div><strong>{item.name}</strong><small>{item.category} · {item.brand}</small></div><div><b>{item.price}</b><span>{item.stock} disponibles · {item.reserved} reservados</span></div></div>)}</section>
            <section className={styles.card}><div className={styles.cardTitle}><div><small>AUTOMATIZACIONES IA</small><h3>Confirmaciones programadas</h3></div></div><div className={styles.automation}><span>09:00</span><div><strong>Llamar a Jean Carlos Mateo</strong><p>Confirmar cita C-1042 una hora antes</p></div><b>Pendiente</b></div><div className={styles.automation}><span>10:30</span><div><strong>Mensaje WhatsApp a Rosa Martínez</strong><p>Recordatorio y ubicación de la visita</p></div><b>Programado</b></div></section>
          </div>
        </>}

        {active === "Conversaciones" && <section className={styles.card}><div className={styles.cardTitle}><div><small>BANDEJA OMNICANAL</small><h3>WhatsApp, llamadas y web</h3></div></div>{conversations.map((item) => <div className={styles.conversation} key={`${item.customer}-${item.time}`}><div className={styles.channel}>{item.channel === "WhatsApp" ? "W" : "☎"}</div><div><strong>{item.customer}</strong><p>{item.text}</p></div><div><span>{item.intent}</span><small>{item.time}</small></div></div>)}</section>}

        {active === "Clientes" && <section className={styles.card}><div className={styles.cardTitle}><div><small>BASE DE CLIENTES</small><h3>Clientes registrados</h3></div><button onClick={() => openManagement("Cliente")}>+ Registrar cliente</button></div><div className={styles.tableHeader}><span>Cliente</span><span>Teléfono</span><span>Dirección</span><span>Origen</span></div>{customers.map((item) => <div className={styles.dataRow} key={item.id}><div><strong>{item.name}</strong><small>{item.id}</small></div><span>{item.phone}</span><span>{item.address}</span><span>{item.source}</span></div>)}</section>}

        {active === "Agenda" && <section className={styles.card}><div className={styles.cardTitle}><div><small>CONTROL OPERATIVO</small><h3>Agenda y reasignación de técnicos</h3></div><button onClick={() => openManagement("Cita")}>+ Crear cita</button></div>{appointments.map((item) => <div className={styles.scheduleRow} key={item.id}><div><strong>{item.time} · {item.customer}</strong><p>{item.service} · {item.zone}</p></div><select value={item.technicianId} onChange={(event) => reassign(item.id, event.target.value)}>{technicians.filter((tech) => tech.status !== "No disponible").map((tech) => <option key={tech.id} value={tech.id}>{tech.name} · {tech.status}</option>)}</select><span>{item.status}</span></div>)}</section>}

        {active === "Técnicos" && <section className={styles.card}><div className={styles.cardTitle}><div><small>EQUIPO DE CAMPO</small><h3>Disponibilidad de técnicos</h3></div></div>{technicians.map((tech) => <div className={styles.technicianRow} key={tech.id}><div><strong>{tech.name}</strong><p>{tech.specialty}</p></div><span>{tech.status}</span><button onClick={() => toggleAvailability(tech.id)}>{tech.status === "No disponible" ? "Marcar disponible" : "Marcar no disponible"}</button></div>)}</section>}

        {active === "Productos" && <section className={styles.card}><div className={styles.cardTitle}><div><small>INVENTARIO Y CATÁLOGO</small><h3>Productos, equipos y piezas</h3></div><button onClick={() => openManagement("Producto")}>+ Registrar producto</button></div><div className={styles.tableHeader}><span>Producto</span><span>Categoría</span><span>Precio</span><span>Existencia</span></div>{products.map((item) => <div className={styles.dataRow} key={item.id}><div><strong>{item.name}</strong><small>{item.brand} · {item.id}</small></div><span>{item.category}</span><span>{item.price}</span><span>{item.stock - item.reserved} disponibles</span></div>)}</section>}

        {active === "Órdenes" && <section className={styles.card}><div className={styles.cardTitle}><div><small>SERVICIO TÉCNICO</small><h3>Órdenes de trabajo</h3></div><button onClick={() => openManagement("Orden")}>+ Crear orden</button></div><div className={styles.tableHeader}><span>Orden y cliente</span><span>Equipo</span><span>Estado</span><span>Técnico</span></div>{orders.map((item) => <div className={styles.dataRow} key={item.id}><div><strong>{item.id}</strong><small>{item.customer} · {item.issue}</small></div><span>{item.equipment}</span><span>{item.status}</span><span>{item.technician}</span></div>)}</section>}

        {active === "Ventas" && <section className={styles.card}><div className={styles.cardTitle}><div><small>GESTIÓN COMERCIAL</small><h3>Ventas y oportunidades</h3></div><button onClick={() => openManagement("Venta")}>+ Registrar venta</button></div><div className={styles.tableHeader}><span>Cliente</span><span>Producto</span><span>Monto</span><span>Estado</span></div>{sales.map((item) => <div className={styles.dataRow} key={item.id}><div><strong>{item.customer}</strong><small>{item.id}</small></div><span>{item.product}</span><span>{item.amount}</span><span>{item.status}</span></div>)}</section>}

        {active === "Cotizaciones" && <section className={styles.card}><div className={styles.cardTitle}><div><small>PROPUESTAS COMERCIALES</small><h3>Cotizaciones</h3></div><button onClick={() => openManagement("Cotización")}>+ Nueva cotización</button></div><div className={styles.tableHeader}><span>Cliente</span><span>Concepto</span><span>Total</span><span>Estado</span></div>{quotes.map((item) => <div className={styles.dataRow} key={item.id}><div><strong>{item.customer}</strong><small>{item.id}</small></div><span>{item.concept}</span><span>{item.total}</span><span>{item.status}</span></div>)}</section>}
      </section>

      {modalOpen && <div className={styles.modalBackdrop} onMouseDown={() => setModalOpen(false)}><section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalHeader}><div><small>NUEVA GESTIÓN PRESENCIAL</small><h2>Registrar {managementType.toLowerCase()}</h2></div><button onClick={() => setModalOpen(false)}>×</button></div><div className={styles.typeGrid}>{(["Cliente","Producto","Cita","Orden","Cotización","Venta"] as ManagementType[]).map((type) => <button className={managementType === type ? styles.selectedType : ""} key={type} onClick={() => setManagementType(type)}>{type}</button>)}</div><form onSubmit={submitManagement}><label>{labelMap[managementType][0]}<input name="name" required /></label><label>{labelMap[managementType][1]}<input name="detail" /></label><label>{labelMap[managementType][2]}<input name="secondary" /></label><div className={styles.modalActions}><button type="button" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit">Guardar gestión</button></div></form></section></div>}
    </main>
  );
}
