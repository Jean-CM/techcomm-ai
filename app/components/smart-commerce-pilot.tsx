"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Message = { role: "customer" | "assistant"; text: string };
type OrderStatus = "Pendiente" | "Confirmada" | "Técnico en camino" | "En diagnóstico" | "Completada";
type WorkOrder = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  equipment: string;
  issue: string;
  appointment: string;
  status: OrderStatus;
  createdAt: string;
};

type Intake = Partial<Omit<WorkOrder, "id" | "status" | "createdAt">>;
type Step = "issue" | "customer" | "phone" | "address" | "appointment" | "confirm" | "complete";

const initialMessages: Message[] = [
  {
    role: "assistant",
    text: "¡Hola! Soy el asistente de Techcomm Smart Commerce. Describe el equipo y el problema; crearé una solicitud de servicio para el piloto."
  }
];

const statusOptions: OrderStatus[] = ["Pendiente", "Confirmada", "Técnico en camino", "En diagnóstico", "Completada"];

function nextAssistant(step: Step, value: string, intake: Intake) {
  if (step === "issue") return `Entendido: ${value}. ¿Cuál es tu nombre completo?`;
  if (step === "customer") return `Gracias, ${value}. ¿Cuál es tu número de teléfono?`;
  if (step === "phone") return "Perfecto. ¿Cuál es la dirección o sector donde se realizará la visita?";
  if (step === "address") return "¿Qué fecha y horario te convienen? Ejemplo: mañana a las 10:00 a. m.";
  if (step === "appointment") {
    return `Resumen: ${intake.equipment ?? "equipo"}, problema: ${intake.issue ?? "por confirmar"}, visita en ${intake.address ?? "dirección pendiente"}, ${value}. La evaluación del piloto tiene un costo referencial de RD$750. Escribe “confirmar” para crear la orden.`;
  }
  return "Escribe “confirmar” para completar la solicitud.";
}

function splitIssue(text: string) {
  const normalized = text.trim();
  const equipmentWords = ["nevera", "lavadora", "televisor", "tv", "aire acondicionado", "celular", "computadora", "laptop", "microondas", "estufa"];
  const equipment = equipmentWords.find((word) => normalized.toLowerCase().includes(word)) ?? "Equipo por identificar";
  return { equipment, issue: normalized };
}

export function SmartCommercePilot() {
  const [view, setView] = useState<"chat" | "dashboard">("chat");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("issue");
  const [intake, setIntake] = useState<Intake>({});
  const [orders, setOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem("techcomm-pilot-orders");
    if (saved) setOrders(JSON.parse(saved) as WorkOrder[]);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("techcomm-pilot-orders", JSON.stringify(orders));
  }, [orders]);

  const metrics = useMemo(() => ({
    total: orders.length,
    today: orders.filter((order) => order.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    active: orders.filter((order) => !["Completada"].includes(order.status)).length,
    completed: orders.filter((order) => order.status === "Completada").length
  }), [orders]);

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;

    setMessages((current) => [...current, { role: "customer", text: value }]);
    setInput("");

    if (step === "confirm") {
      if (!value.toLowerCase().includes("confirm")) {
        setMessages((current) => [...current, { role: "assistant", text: "Para crear la orden escribe “confirmar”. También puedes reiniciar el flujo." }]);
        return;
      }

      const order: WorkOrder = {
        id: `OT-${String(Date.now()).slice(-6)}`,
        customer: intake.customer ?? "Cliente piloto",
        phone: intake.phone ?? "Sin teléfono",
        address: intake.address ?? "Sin dirección",
        equipment: intake.equipment ?? "Equipo por identificar",
        issue: intake.issue ?? "Sin detalle",
        appointment: intake.appointment ?? "Por coordinar",
        status: "Confirmada",
        createdAt: new Date().toISOString()
      };
      setOrders((current) => [order, ...current]);
      setStep("complete");
      setMessages((current) => [...current, {
        role: "assistant",
        text: `¡Listo! La orden ${order.id} fue creada y la visita quedó confirmada para ${order.appointment}. Ya puedes verla en el Panel administrativo.`
      }]);
      return;
    }

    if (step === "complete") {
      setMessages((current) => [...current, { role: "assistant", text: "La solicitud ya fue creada. Abre el Panel o reinicia para registrar otra." }]);
      return;
    }

    let nextIntake = { ...intake };
    if (step === "issue") nextIntake = { ...nextIntake, ...splitIssue(value) };
    if (step === "customer") nextIntake.customer = value;
    if (step === "phone") nextIntake.phone = value;
    if (step === "address") nextIntake.address = value;
    if (step === "appointment") nextIntake.appointment = value;

    const stepOrder: Record<Exclude<Step, "confirm" | "complete">, Step> = {
      issue: "customer",
      customer: "phone",
      phone: "address",
      address: "appointment",
      appointment: "confirm"
    };
    const nextStep = stepOrder[step as Exclude<Step, "confirm" | "complete">];
    setIntake(nextIntake);
    setStep(nextStep);
    setMessages((current) => [...current, { role: "assistant", text: nextAssistant(step, value, nextIntake) }]);
  }

  function restart() {
    setMessages(initialMessages);
    setInput("");
    setIntake({});
    setStep("issue");
    setView("chat");
  }

  function updateStatus(id: string, status: OrderStatus) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
  }

  return (
    <div className="mvp-shell">
      <aside className="mvp-sidebar">
        <div>
          <span className="eyebrow">Piloto MVP</span>
          <h3>Centro de operaciones</h3>
        </div>
        <button className={`mvp-nav ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")} type="button">Asistente del cliente</button>
        <button className={`mvp-nav ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")} type="button">Panel administrativo <span>{orders.length}</span></button>
        <button className="mvp-nav" onClick={restart} type="button">Nueva prueba</button>
        <div className="mvp-live"><span className="signal-dot" /> Piloto activo</div>
      </aside>

      {view === "chat" ? (
        <section className="mvp-workspace card">
          <header className="mvp-header">
            <div><span className="eyebrow">Canal web</span><h2>Asistente de servicio</h2></div>
            <button className="button button-secondary button-small" onClick={() => setView("dashboard")} type="button">Ver órdenes</button>
          </header>
          <div className="mvp-chat">
            {messages.map((message, index) => (
              <div className={`mvp-message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === "assistant" ? "Techcomm IA" : "Cliente"}</small>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <form className="mvp-composer" onSubmit={submitMessage}>
            <input
              aria-label="Mensaje"
              className="input"
              onChange={(event) => setInput(event.target.value)}
              placeholder={step === "confirm" ? "Escribe confirmar…" : "Escribe tu respuesta…"}
              value={input}
            />
            <button className="button" type="submit">Enviar</button>
          </form>
          <div className="mvp-hint">Prueba rápida: “Mi nevera dejó de enfriar”.</div>
        </section>
      ) : (
        <section className="mvp-dashboard">
          <header className="mvp-header card">
            <div><span className="eyebrow">Administración</span><h2>Panel del piloto</h2></div>
            <button className="button" onClick={() => setView("chat")} type="button">Crear solicitud</button>
          </header>
          <div className="mvp-metrics">
            <article className="card"><span>Total órdenes</span><strong>{metrics.total}</strong></article>
            <article className="card"><span>Creadas hoy</span><strong>{metrics.today}</strong></article>
            <article className="card"><span>Activas</span><strong>{metrics.active}</strong></article>
            <article className="card"><span>Completadas</span><strong>{metrics.completed}</strong></article>
          </div>
          <div className="card mvp-orders">
            <div className="mvp-orders-title"><div><span className="eyebrow">Operación</span><h3>Órdenes de servicio</h3></div></div>
            {orders.length === 0 ? (
              <div className="mvp-empty"><h3>Aún no hay órdenes</h3><p>Completa una conversación en el asistente y aparecerá aquí automáticamente.</p></div>
            ) : (
              <div className="mvp-order-list">
                {orders.map((order) => (
                  <article className="mvp-order" key={order.id}>
                    <div className="mvp-order-main">
                      <div><strong>{order.id}</strong><span>{order.customer} · {order.phone}</span></div>
                      <span className="mvp-status-pill">{order.status}</span>
                    </div>
                    <div className="mvp-order-grid">
                      <p><small>Equipo</small>{order.equipment}</p>
                      <p><small>Problema</small>{order.issue}</p>
                      <p><small>Dirección</small>{order.address}</p>
                      <p><small>Cita</small>{order.appointment}</p>
                    </div>
                    <label className="mvp-status-control">Actualizar estado
                      <select className="input" value={order.status} onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}>
                        {statusOptions.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
