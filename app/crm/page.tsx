"use client";

import { useMemo, useState } from "react";
import styles from "./crm.module.css";

type Technician = { id: string; name: string; status: "Disponible" | "Ocupado" | "No disponible"; specialty: string };
type Appointment = { id: string; time: string; customer: string; service: string; zone: string; technicianId: string; status: string };

const techniciansSeed: Technician[] = [
  { id: "t1", name: "Luis Pérez", status: "Disponible", specialty: "TV y audio" },
  { id: "t2", name: "Carlos Méndez", status: "Ocupado", specialty: "Neveras y lavadoras" },
  { id: "t3", name: "Ana Rodríguez", status: "Disponible", specialty: "Celulares y laptops" },
  { id: "t4", name: "Miguel Santos", status: "No disponible", specialty: "Electrodomésticos" }
];

const appointmentsSeed: Appointment[] = [
  { id: "C-1042", time: "10:00 a. m.", customer: "Jean Carlos Mateo", service: "Nevera LG no enfría", zone: "Villa Mella", technicianId: "t2", status: "Confirmada" },
  { id: "C-1043", time: "11:30 a. m.", customer: "Rosa Martínez", service: "TV Samsung sin imagen", zone: "Santo Domingo Este", technicianId: "t1", status: "Pendiente" },
  { id: "C-1044", time: "2:00 p. m.", customer: "Pedro Gómez", service: "Laptop no enciende", zone: "Los Prados", technicianId: "t3", status: "Confirmada" }
];

const conversations = [
  { channel: "WhatsApp", customer: "Jean Carlos Mateo", text: "Mi nevera dejó de enfriar", intent: "Reparación", time: "Ahora" },
  { channel: "WhatsApp", customer: "Laura Díaz", text: "¿Tienen iPhone 15 disponible?", intent: "Venta", time: "Hace 4 min" },
  { channel: "Llamada", customer: "Rosa Martínez", text: "Confirmó visita técnica", intent: "Confirmación", time: "Hace 12 min" }
];

const products = [
  { name: "iPhone 15 128 GB", category: "Celulares", stock: 4, reserved: 1, price: "RD$ 54,900" },
  { name: "TV Samsung 55\" 4K", category: "Televisores", stock: 2, reserved: 0, price: "RD$ 39,500" },
  { name: "Cargador USB-C 25W", category: "Accesorios", stock: 18, reserved: 3, price: "RD$ 1,650" }
];

export default function CrmPage() {
  const [active, setActive] = useState("Dashboard");
  const [technicians, setTechnicians] = useState(techniciansSeed);
  const [appointments, setAppointments] = useState(appointmentsSeed);

  const available = useMemo(() => technicians.filter((item) => item.status === "Disponible").length, [technicians]);

  function reassign(appointmentId: string, technicianId: string) {
    setAppointments((current) => current.map((item) => item.id === appointmentId ? { ...item, technicianId } : item));
  }

  function toggleAvailability(technicianId: string) {
    setTechnicians((current) => current.map((item) => item.id === technicianId
      ? { ...item, status: item.status === "No disponible" ? "Disponible" : "No disponible" }
      : item));
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div><span className={styles.brand}>TECHCOMM AI</span><h2>Techcomm 360</h2><p>Centro de operaciones omnicanal</p></div>
        <nav>{["Dashboard","Conversaciones","Clientes","Agenda","Técnicos","Órdenes","Ventas","Productos","Cotizaciones"].map((item) => <button className={active === item ? styles.active : ""} key={item} onClick={() => setActive(item)}>{item}</button>)}</nav>
        <div className={styles.channelStatus}><span /> WhatsApp conectado<br/><span /> Agente de voz activo</div>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}><div><small>OPERACIÓN EN TIEMPO REAL</small><h1>{active}</h1></div><div className={styles.headerActions}><button>+ Nueva gestión</button><div className={styles.avatar}>JC</div></div></header>

        {active === "Dashboard" && <>
          <div className={styles.metrics}>
            <article><small>Conversaciones activas</small><strong>8</strong><span>5 WhatsApp · 3 web</span></article>
            <article><small>Citas de hoy</small><strong>{appointments.length}</strong><span>2 confirmadas</span></article>
            <article><small>Oportunidades de venta</small><strong>6</strong><span>RD$ 184,300 estimados</span></article>
            <article><small>Técnicos disponibles</small><strong>{available}</strong><span>1 incidencia operativa</span></article>
          </div>

          <div className={styles.gridTwo}>
            <section className={styles.card}><div className={styles.cardTitle}><div><small>BANDEJA OMNICANAL</small><h3>Conversaciones recientes</h3></div><button onClick={() => setActive("Conversaciones")}>Ver todas</button></div>{conversations.map((item) => <div className={styles.conversation} key={item.customer}><div className={styles.channel}>{item.channel === "WhatsApp" ? "W" : "☎"}</div><div><strong>{item.customer}</strong><p>{item.text}</p></div><div><span>{item.intent}</span><small>{item.time}</small></div></div>)}</section>

            <section className={styles.card}><div className={styles.cardTitle}><div><small>AGENDA INTELIGENTE</small><h3>Próximas visitas</h3></div><button onClick={() => setActive("Agenda")}>Abrir calendario</button></div>{appointments.map((item) => { const tech = technicians.find((t) => t.id === item.technicianId); return <div className={styles.appointment} key={item.id}><div className={styles.time}>{item.time}</div><div><strong>{item.customer}</strong><p>{item.service} · {item.zone}</p><small>{item.id} · {item.status}</small></div><div className={styles.techBadge}>{tech?.name}<span>{tech?.status}</span></div></div>})}</section>
          </div>

          <div className={styles.gridTwo}>
            <section className={styles.card}><div className={styles.cardTitle}><div><small>VENTAS E INVENTARIO</small><h3>Productos consultados</h3></div><button onClick={() => setActive("Productos")}>Gestionar inventario</button></div>{products.map((item) => <div className={styles.product} key={item.name}><div><strong>{item.name}</strong><small>{item.category}</small></div><div><b>{item.price}</b><span>{item.stock} disponibles · {item.reserved} reservados</span></div></div>)}</section>
            <section className={styles.card}><div className={styles.cardTitle}><div><small>AUTOMATIZACIONES IA</small><h3>Confirmaciones programadas</h3></div></div><div className={styles.automation}><span>09:00</span><div><strong>Llamar a Jean Carlos Mateo</strong><p>Confirmar cita C-1042 una hora antes</p></div><b>Pendiente</b></div><div className={styles.automation}><span>10:30</span><div><strong>Mensaje WhatsApp a Rosa Martínez</strong><p>Recordatorio y ubicación de la visita</p></div><b>Programado</b></div></section>
          </div>
        </>}

        {active === "Agenda" && <section className={styles.card}><div className={styles.cardTitle}><div><small>CONTROL OPERATIVO</small><h3>Agenda y reasignación de técnicos</h3></div></div>{appointments.map((item) => <div className={styles.scheduleRow} key={item.id}><div><strong>{item.time} · {item.customer}</strong><p>{item.service} · {item.zone}</p></div><select value={item.technicianId} onChange={(event) => reassign(item.id, event.target.value)}>{technicians.filter((tech) => tech.status !== "No disponible").map((tech) => <option key={tech.id} value={tech.id}>{tech.name} · {tech.status}</option>)}</select><span>{item.status}</span></div>)}</section>}

        {active === "Técnicos" && <section className={styles.card}><div className={styles.cardTitle}><div><small>EQUIPO DE CAMPO</small><h3>Disponibilidad de técnicos</h3></div></div>{technicians.map((tech) => <div className={styles.technicianRow} key={tech.id}><div><strong>{tech.name}</strong><p>{tech.specialty}</p></div><span>{tech.status}</span><button onClick={() => toggleAvailability(tech.id)}>{tech.status === "No disponible" ? "Marcar disponible" : "Marcar no disponible"}</button></div>)}</section>}

        {!["Dashboard","Agenda","Técnicos"].includes(active) && <section className={styles.card}><div className={styles.placeholder}><small>MÓDULO CRM</small><h2>{active}</h2><p>Este módulo ya forma parte del alcance de Techcomm 360 y será conectado a Supabase y WhatsApp en la siguiente integración.</p></div></section>}
      </section>
    </main>
  );
}
