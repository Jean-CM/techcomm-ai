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
  priority: "Normal" | "Urgente";
  source: "Neo IA";
};

type Intake = Partial<Omit<WorkOrder, "id" | "status" | "createdAt" | "priority" | "source">>;
type Step = "issue" | "customer" | "phone" | "address" | "appointment" | "confirm" | "complete";
type ToolState = "idle" | "running" | "done";

const initialMessages: Message[] = [
  {
    role: "assistant",
    text: "Hola, soy Neo IA, el agente digital de Techcomm. Cuéntame qué equipo presenta problemas y me encargaré de organizar la visita, preparar la orden y dejar todo listo."
  }
];

const statusOptions: OrderStatus[] = ["Pendiente", "Confirmada", "Técnico en camino", "En diagnóstico", "Completada"];

function nextAssistant(step: Step, value: string, intake: Intake) {
  if (step === "issue") return `Ya identifiqué la solicitud: ${value}. Para registrar el caso correctamente, ¿cuál es tu nombre completo?`;
  if (step === "customer") return `Gracias, ${value}. ¿Cuál es el número de teléfono donde podemos contactarte?`;
  if (step === "phone") return "Perfecto. Indícame la dirección o el sector donde se realizará la visita.";
  if (step === "address") return "Estoy revisando la agenda. ¿Qué fecha y horario te convienen? Por ejemplo: mañana a las 10:00 a. m.";
  if (step === "appointment") {
    return `Todo está listo. Detecté un servicio para ${intake.equipment ?? "el equipo"}, en ${intake.address ?? "la dirección indicada"}, para ${value}. La evaluación tiene un costo referencial de RD$750. Escribe “confirmar” y crearé la cita y la orden de servicio.`;
  }
  return "Escribe “confirmar” para completar la solicitud.";
}

function splitIssue(text: string) {
  const normalized = text.trim();
  const equipmentWords = ["nevera", "lavadora", "televisor", "tv", "aire acondicionado", "celular", "computadora", "laptop", "microondas", "estufa"];
  const equipment = equipmentWords.find((word) => normalized.toLowerCase().includes(word)) ?? "Equipo por identificar";
  return { equipment, issue: normalized };
}

function formatRelative(date: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "Ahora mismo";
  if (minutes === 1) return "Hace 1 minuto";
  if (minutes < 60) return `Hace ${minutes} minutos`;
  return new Date(date).toLocaleString("es-DO");
}

export function SmartCommercePilot() {
  const [view, setView] = useState<"chat" | "dashboard">("chat");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("issue");
  const [intake, setIntake] = useState<Intake>({});
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [thinking, setThinking] = useState(false);

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
    active: orders.filter((order) => order.status !== "Completada").length,
    completed: orders.filter((order) => order.status === "Completada").length
  }), [orders]);

  const confidence = step === "issue" ? 42 : step === "customer" ? 63 : step === "phone" ? 74 : step === "address" ? 84 : step === "appointment" ? 92 : 98;
  const intent = intake.issue ? "Reparación a domicilio" : "Analizando intención";

  const tools = useMemo(() => {
    const state = (done: boolean, active: boolean): ToolState => done ? "done" : active ? "running" : "idle";
    return [
      { name: "Detectar intención", state: state(Boolean(intake.issue), step === "issue") },
      { name: "Identificar cliente", state: state(Boolean(intake.customer && intake.phone), ["customer", "phone"].includes(step)) },
      { name: "Validar ubicación", state: state(Boolean(intake.address), step === "address") },
      { name: "Consultar agenda", state: state(Boolean(intake.appointment), step === "appointment") },
      { name: "Crear orden", state: state(step === "complete", step === "confirm") }
    ];
  }, [intake, step]);

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value || thinking) return;

    setMessages((current) => [...current, { role: "customer", text: value }]);
    setInput("");
    setThinking(true);

    window.setTimeout(() => {
      if (step === "confirm") {
        if (!value.toLowerCase().includes("confirm")) {
          setMessages((current) => [...current, { role: "assistant", text: "Necesito tu confirmación para ejecutar las acciones. Escribe “confirmar” o indícame qué dato deseas cambiar." }]);
          setThinking(false);
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
          createdAt: new Date().toISOString(),
          priority: "Normal",
          source: "Neo IA"
        };
        setOrders((current) => [order, ...current]);
        setStep("complete");
        setMessages((current) => [...current, {
          role: "assistant",
          text: `Proceso completado. Creé la orden ${order.id}, registré la cita para ${order.appointment} y dejé el caso disponible en el panel administrativo.`
        }]);
        setThinking(false);
        return;
      }

      if (step === "complete") {
        setMessages((current) => [...current, { role: "assistant", text: "Este caso ya está registrado. Puedes abrir el panel o iniciar una nueva conversación." }]);
        setThinking(false);
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
      setThinking(false);
    }, 650);
  }

  function restart() {
    setMessages(initialMessages);
    setInput("");
    setIntake({});
    setStep("issue");
    setThinking(false);
    setView("chat");
  }

  function updateStatus(id: string, status: OrderStatus) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
  }

  return (
    <div className="mvp-shell">
      <aside className="mvp-sidebar">
        <div>
          <span className="eyebrow">Techcomm AI</span>
          <h3>Centro de operaciones</h3>
        </div>
        <button className={`mvp-nav ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")} type="button">Neo IA Command Center</button>
        <button className={`mvp-nav ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")} type="button">Panel administrativo <span>{orders.length}</span></button>
        <button className="mvp-nav" onClick={restart} type="button">Nueva conversación</button>
        <div className="mvp-live"><span className="signal-dot" /> Neo IA operativo</div>
      </aside>

      {view === "chat" ? (
        <section className="ai-command-center">
          <header className="mvp-header card ai-topbar">
            <div><span className="eyebrow">Agente digital activo</span><h2>Neo IA Command Center</h2></div>
            <div className="ai-health"><span className="signal-dot" /> Sistema listo · respuesta 0.7 s</div>
          </header>

          <div className="ai-grid">
            <section className="mvp-workspace card">
              <div className="ai-chat-head">
                <div className="ai-avatar">N</div>
                <div><strong>Neo IA</strong><span>Atención, agenda y órdenes de servicio</span></div>
                <span className="pilot-status">En línea</span>
              </div>
              <div className="mvp-chat">
                {messages.map((message, index) => (
                  <div className={`mvp-message ${message.role}`} key={`${message.role}-${index}`}>
                    <small>{message.role === "assistant" ? "Neo IA" : "Cliente"}</small>
                    <p>{message.text}</p>
                  </div>
                ))}
                {thinking && <div className="mvp-message assistant ai-thinking"><small>Neo IA</small><p><span /> Analizando y ejecutando acciones…</p></div>}
              </div>
              <form className="mvp-composer" onSubmit={submitMessage}>
                <input
                  aria-label="Mensaje"
                  className="input"
                  disabled={thinking}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={step === "confirm" ? "Escribe confirmar…" : "Describe tu necesidad…"}
                  value={input}
                />
                <button className="button" disabled={thinking} type="submit">Enviar a Neo</button>
              </form>
              <div className="mvp-hint">Prueba: “Mi nevera dejó de enfriar”. Neo detectará el caso y construirá la orden.</div>
            </section>

            <aside className="ai-intelligence card">
              <div className="ai-panel-title"><div><span className="eyebrow">Inteligencia en vivo</span><h3>Comprensión del caso</h3></div><strong>{confidence}%</strong></div>
              <div className="ai-confidence"><span style={{ width: `${confidence}%` }} /></div>

              <div className="ai-insight"><small>Intención detectada</small><strong>{intent}</strong></div>
              <div className="ai-data-grid">
                <div><small>Equipo</small><strong>{intake.equipment ?? "Pendiente"}</strong></div>
                <div><small>Cliente</small><strong>{intake.customer ?? "Pendiente"}</strong></div>
                <div><small>Teléfono</small><strong>{intake.phone ?? "Pendiente"}</strong></div>
                <div><small>Dirección</small><strong>{intake.address ?? "Pendiente"}</strong></div>
                <div><small>Cita</small><strong>{intake.appointment ?? "Pendiente"}</strong></div>
                <div><small>Prioridad</small><strong>Normal</strong></div>
              </div>

              <div className="ai-tools">
                <span className="eyebrow">Herramientas del agente</span>
                {tools.map((tool) => (
                  <div className={`ai-tool ${tool.state}`} key={tool.name}>
                    <span>{tool.state === "done" ? "✓" : tool.state === "running" ? "●" : "○"}</span>
                    <p>{tool.name}</p>
                    <small>{tool.state === "done" ? "Completado" : tool.state === "running" ? "Ejecutando" : "En espera"}</small>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section className="mvp-dashboard">
          <header className="mvp-header card">
            <div><span className="eyebrow">Administración</span><h2>Panel del piloto</h2></div>
            <button className="button" onClick={() => setView("chat")} type="button">Abrir Neo IA</button>
          </header>
          <div className="mvp-metrics">
            <article className="card"><span>Total órdenes</span><strong>{metrics.total}</strong></article>
            <article className="card"><span>Creadas hoy</span><strong>{metrics.today}</strong></article>
            <article className="card"><span>Activas</span><strong>{metrics.active}</strong></article>
            <article className="card"><span>Completadas</span><strong>{metrics.completed}</strong></article>
          </div>
          <div className="card mvp-orders">
            <div className="mvp-orders-title"><div><span className="eyebrow">Operación en tiempo real</span><h3>Órdenes de servicio</h3></div></div>
            {orders.length === 0 ? (
              <div className="mvp-empty"><h3>Aún no hay órdenes</h3><p>Completa una conversación con Neo IA y aparecerá aquí automáticamente.</p></div>
            ) : (
              <div className="mvp-order-list">
                {orders.map((order) => (
                  <article className="mvp-order" key={order.id}>
                    <div className="mvp-order-main">
                      <div><strong>{order.id}</strong><span>{order.customer} · {order.phone}</span><small>{formatRelative(order.createdAt)} · Creada por {order.source}</small></div>
                      <div className="order-badges"><span className="priority-pill">{order.priority}</span><span className="mvp-status-pill">{order.status}</span></div>
                    </div>
                    <div className="mvp-order-grid">
                      <p><small>Equipo</small>{order.equipment}</p>
                      <p><small>Problema</small>{order.issue}</p>
                      <p><small>Dirección</small>{order.address}</p>
                      <p><small>Cita</small>{order.appointment}</p>
                    </div>
                    <div className="order-actions">
                      <label className="mvp-status-control">Actualizar estado
                        <select className="input" value={order.status} onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}>
                          {statusOptions.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </label>
                      <div className="quick-actions"><button type="button">Llamar</button><button type="button">WhatsApp</button><button type="button">Asignar técnico</button></div>
                    </div>
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
