"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Message = { role: "customer" | "assistant"; text: string };
type OrderStatus = "Pendiente" | "Confirmada" | "Técnico en camino" | "En diagnóstico" | "Completada";
type Intent = "repair" | "quote" | "status" | "general" | "unknown";
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
type Step = "need" | "customer" | "phone" | "address" | "appointment" | "confirm" | "quote_details" | "status_id" | "general_followup" | "complete";
type ToolState = "idle" | "running" | "done";

const initialMessages: Message[] = [
  {
    role: "assistant",
    text: "¡Hola! Soy Neo, el asistente digital de Techcomm. Puedo ayudarte con reparaciones, precios y disponibilidad de equipos, cotizaciones o el seguimiento de una solicitud. ¿Qué necesitas hoy?"
  }
];

const statusOptions: OrderStatus[] = ["Pendiente", "Confirmada", "Técnico en camino", "En diagnóstico", "Completada"];

function detectIntent(text: string): Intent {
  const value = text.toLowerCase();
  if (/estado|seguimiento|orden|solicitud|técnico|tecnico/.test(value)) return "status";
  if (/precio|cotiz|comprar|disponib|venden|tienen|producto|modelo/.test(value)) return "quote";
  if (/dañ|dano|falla|problema|no enciende|no enfría|no enfria|ruido|repar|avería|averia|visita/.test(value)) return "repair";
  if (/hola|horario|ubicación|ubicacion|servicio|información|informacion|pregunta|consulta/.test(value)) return "general";
  return "unknown";
}

function splitNeed(text: string) {
  const normalized = text.trim();
  const equipmentWords = ["nevera", "lavadora", "televisor", "tv", "aire acondicionado", "celular", "computadora", "laptop", "microondas", "estufa", "secadora", "tablet"];
  const equipment = equipmentWords.find((word) => normalized.toLowerCase().includes(word)) ?? "Equipo por identificar";
  return { equipment, issue: normalized };
}

function normalizeDominicanPhone(text: string) {
  const digits = text.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^(809|829|849)\d{7}$/.test(local)) return null;
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

function formatRelative(date: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "Ahora mismo";
  if (minutes === 1) return "Hace 1 minuto";
  if (minutes < 60) return `Hace ${minutes} minutos`;
  return new Date(date).toLocaleString("es-DO");
}

function intentLabel(intent: Intent) {
  if (intent === "repair") return "Reparación o visita técnica";
  if (intent === "quote") return "Consulta comercial o cotización";
  if (intent === "status") return "Seguimiento de solicitud";
  if (intent === "general") return "Consulta general";
  return "Analizando necesidad";
}

export function SmartCommercePilot() {
  const [view, setView] = useState<"chat" | "dashboard">("chat");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("need");
  const [intent, setIntent] = useState<Intent>("unknown");
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

  const confidence = step === "need" ? 28 : step === "customer" ? 56 : step === "phone" ? 68 : step === "address" ? 80 : step === "appointment" ? 90 : 98;

  const tools = useMemo(() => {
    const state = (done: boolean, active: boolean): ToolState => done ? "done" : active ? "running" : "idle";
    return [
      { name: "Comprender la necesidad", state: state(intent !== "unknown", step === "need") },
      { name: "Identificar al cliente", state: state(Boolean(intake.customer), step === "customer") },
      { name: "Validar teléfono", state: state(Boolean(intake.phone), step === "phone") },
      { name: "Preparar gestión", state: state(Boolean(intake.address || intent !== "repair"), ["address", "appointment", "quote_details", "status_id", "general_followup"].includes(step)) },
      { name: "Registrar solicitud", state: state(step === "complete", step === "confirm") }
    ];
  }, [intake, intent, step]);

  function addAssistant(text: string) {
    setMessages((current) => [...current, { role: "assistant", text }]);
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value || thinking) return;

    setMessages((current) => [...current, { role: "customer", text: value }]);
    setInput("");
    setThinking(true);

    window.setTimeout(() => {
      if (step === "need") {
        const detected = detectIntent(value);
        setIntent(detected);

        if (detected === "repair") {
          setIntake((current) => ({ ...current, ...splitNeed(value) }));
          setStep("customer");
          addAssistant("Entiendo. Para orientarte bien, primero registraré el caso y luego coordinaremos la visita. ¿A nombre de quién debo crear la solicitud?");
        } else if (detected === "quote") {
          setIntake((current) => ({ ...current, issue: value }));
          setStep("quote_details");
          addAssistant("Claro. Puedo ayudarte a revisar opciones y dejar una cotización preparada. ¿Qué producto o modelo buscas y qué presupuesto aproximado tienes?");
        } else if (detected === "status") {
          setStep("status_id");
          addAssistant("Con gusto reviso el seguimiento. Escríbeme el número de orden, por ejemplo OT-001788. Si no lo tienes, también puedo buscarla usando el teléfono registrado.");
        } else if (detected === "general") {
          setStep("general_followup");
          addAssistant("Claro, cuéntame un poco más. Puedo informarte sobre servicios, horarios, cobertura, productos, precios o ayudarte a iniciar una solicitud.");
        } else {
          addAssistant("Puedo ayudarte con una reparación, una cotización, disponibilidad de productos o el estado de una orden. Cuéntame cuál de estas gestiones necesitas.");
        }
        setThinking(false);
        return;
      }

      if (step === "quote_details") {
        setIntake((current) => ({ ...current, equipment: value, issue: `${current.issue ?? "Consulta comercial"}. Preferencias: ${value}` }));
        setStep("customer");
        addAssistant("Perfecto, ya tengo la referencia de lo que buscas. ¿Cuál es tu nombre completo para preparar la solicitud comercial?");
        setThinking(false);
        return;
      }

      if (step === "status_id") {
        const orderId = value.toUpperCase().match(/OT-?\d+/)?.[0]?.replace("OT", "OT-");
        const found = orderId ? orders.find((order) => order.id === orderId) : undefined;
        if (found) {
          addAssistant(`Encontré la orden ${found.id}. Está en estado “${found.status}” y la cita registrada es ${found.appointment}. ¿Necesitas que actualicemos algún dato o que un asesor te contacte?`);
        } else {
          addAssistant("No encontré una orden con ese dato en este piloto. Verifica el número o escribe el teléfono usado al registrarla.");
        }
        setThinking(false);
        return;
      }

      if (step === "general_followup") {
        const redirected = detectIntent(value);
        if (redirected === "repair" || redirected === "quote" || redirected === "status") {
          setStep("need");
          setThinking(false);
          setInput(value);
          addAssistant("Entendido. Ya veo qué tipo de gestión necesitas; envíame ese detalle una vez más para iniciar el flujo correspondiente.");
        } else {
          addAssistant("Gracias por explicarlo. En esta versión del piloto puedo registrar tu consulta para seguimiento. ¿Deseas que un asesor te contacte? Indícame tu nombre y luego validaré tu teléfono.");
          setIntent("general");
          setIntake((current) => ({ ...current, issue: value, equipment: "Consulta general" }));
          setStep("customer");
          setThinking(false);
        }
        return;
      }

      if (step === "customer") {
        if (value.length < 3) {
          addAssistant("Necesito un nombre válido para identificar la gestión. Escríbeme tu nombre y apellido, por favor.");
        } else {
          setIntake((current) => ({ ...current, customer: value }));
          setStep("phone");
          addAssistant(`Gracias, ${value}. Ahora indícame un teléfono válido de República Dominicana. Acepto números 809, 829 o 849; puedes escribirlo como 809-555-1234.`);
        }
        setThinking(false);
        return;
      }

      if (step === "phone") {
        const phone = normalizeDominicanPhone(value);
        if (!phone) {
          addAssistant("Ese teléfono no parece válido. Debe tener 10 dígitos y comenzar con 809, 829 o 849. Ejemplo: 829-555-1234. Revísalo y envíamelo nuevamente.");
          setThinking(false);
          return;
        }

        setIntake((current) => ({ ...current, phone }));
        if (intent === "repair") {
          setStep("address");
          addAssistant(`Perfecto, validé el número ${phone}. ¿En qué dirección o sector se encuentra el equipo? Incluye una referencia breve para facilitar la visita.`);
        } else {
          setStep("confirm");
          addAssistant(`Teléfono validado: ${phone}. Ya tengo los datos necesarios para registrar tu ${intent === "quote" ? "solicitud de cotización" : "consulta"}. Escribe “confirmar” para guardarla.`);
        }
        setThinking(false);
        return;
      }

      if (step === "address") {
        if (value.length < 5) {
          addAssistant("Necesito una dirección o sector un poco más específico para coordinar correctamente la visita.");
        } else {
          setIntake((current) => ({ ...current, address: value }));
          setStep("appointment");
          addAssistant("Gracias. ¿Qué día y rango de horario te convienen para recibir al técnico? Por ejemplo: lunes entre 9:00 a. m. y 12:00 p. m.");
        }
        setThinking(false);
        return;
      }

      if (step === "appointment") {
        setIntake((current) => ({ ...current, appointment: value }));
        setStep("confirm");
        addAssistant(`Perfecto. Preparé este resumen: ${intake.equipment ?? "equipo"}, detalle “${intake.issue ?? "por confirmar"}”, visita en ${intake.address ?? "dirección pendiente"}, horario ${value}, contacto ${intake.phone}. La evaluación tiene un costo referencial de RD$750. Escribe “confirmar” para crear la cita y la orden.`);
        setThinking(false);
        return;
      }

      if (step === "confirm") {
        if (!value.toLowerCase().includes("confirm")) {
          addAssistant("Aún no he registrado la gestión. Escribe “confirmar” para continuar o dime qué dato deseas corregir.");
          setThinking(false);
          return;
        }

        const order: WorkOrder = {
          id: `OT-${String(Date.now()).slice(-6)}`,
          customer: intake.customer ?? "Cliente piloto",
          phone: intake.phone ?? "Sin teléfono",
          address: intake.address ?? (intent === "repair" ? "Sin dirección" : "No aplica"),
          equipment: intake.equipment ?? (intent === "quote" ? "Solicitud comercial" : "Consulta"),
          issue: intake.issue ?? "Sin detalle",
          appointment: intake.appointment ?? (intent === "repair" ? "Por coordinar" : "Seguimiento comercial"),
          status: intent === "repair" ? "Confirmada" : "Pendiente",
          createdAt: new Date().toISOString(),
          priority: "Normal",
          source: "Neo IA"
        };
        setOrders((current) => [order, ...current]);
        setStep("complete");
        addAssistant(`Listo, ${order.customer}. Registré la gestión con el número ${order.id}. El teléfono confirmado es ${order.phone}. ${intent === "repair" ? `La visita quedó solicitada para ${order.appointment}.` : "El equipo de Techcomm podrá darle seguimiento desde el panel."}`);
        setThinking(false);
        return;
      }

      addAssistant("Esta gestión ya fue registrada. Puedes abrir el panel o iniciar una nueva conversación.");
      setThinking(false);
    }, 650);
  }

  function restart() {
    setMessages(initialMessages);
    setInput("");
    setIntake({});
    setIntent("unknown");
    setStep("need");
    setThinking(false);
    setView("chat");
  }

  function updateStatus(id: string, status: OrderStatus) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
  }

  return (
    <div className="mvp-shell">
      <aside className="mvp-sidebar">
        <div><span className="eyebrow">Techcomm AI</span><h3>Centro de operaciones</h3></div>
        <button className={`mvp-nav ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")} type="button">Neo IA Command Center</button>
        <button className={`mvp-nav ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")} type="button">Panel administrativo <span>{orders.length}</span></button>
        <button className="mvp-nav" onClick={restart} type="button">Nueva conversación</button>
        <div className="mvp-live"><span className="signal-dot" /> Neo IA operativo</div>
      </aside>

      {view === "chat" ? (
        <section className="ai-command-center">
          <header className="mvp-header card ai-topbar">
            <div><span className="eyebrow">Atención digital activa</span><h2>Neo IA Command Center</h2></div>
            <div className="ai-health"><span className="signal-dot" /> Sistema listo · gestión multicanal</div>
          </header>
          <div className="ai-grid">
            <section className="mvp-workspace card">
              <div className="ai-chat-head">
                <div className="ai-avatar">N</div>
                <div><strong>Neo IA</strong><span>Consultas, ventas, cotizaciones y servicio técnico</span></div>
                <span className="pilot-status">En línea</span>
              </div>
              <div className="mvp-chat">
                {messages.map((message, index) => (
                  <div className={`mvp-message ${message.role}`} key={`${message.role}-${index}`}>
                    <small>{message.role === "assistant" ? "Neo IA" : "Cliente"}</small><p>{message.text}</p>
                  </div>
                ))}
                {thinking && <div className="mvp-message assistant ai-thinking"><small>Neo IA</small><p><span /> Analizando tu solicitud…</p></div>}
              </div>
              <form className="mvp-composer" onSubmit={submitMessage}>
                <input aria-label="Mensaje" className="input" disabled={thinking} onChange={(event) => setInput(event.target.value)} placeholder={step === "confirm" ? "Escribe confirmar o indica qué deseas corregir…" : "Escribe tu consulta o solicitud…"} value={input} />
                <button className="button" disabled={thinking} type="submit">Enviar</button>
              </form>
              <div className="mvp-hint">Prueba: “Quiero saber el precio de un televisor”, “Mi nevera no enfría” o “Quiero consultar mi orden”.</div>
            </section>

            <aside className="ai-intelligence card">
              <div className="ai-panel-title"><div><span className="eyebrow">Inteligencia en vivo</span><h3>Comprensión de la gestión</h3></div><strong>{confidence}%</strong></div>
              <div className="ai-confidence"><span style={{ width: `${confidence}%` }} /></div>
              <div className="ai-insight"><small>Intención detectada</small><strong>{intentLabel(intent)}</strong></div>
              <div className="ai-data-grid">
                <div><small>Gestión</small><strong>{intentLabel(intent)}</strong></div>
                <div><small>Cliente</small><strong>{intake.customer ?? "Pendiente"}</strong></div>
                <div><small>Teléfono</small><strong>{intake.phone ?? "Pendiente de validar"}</strong></div>
                <div><small>Equipo o producto</small><strong>{intake.equipment ?? "Pendiente"}</strong></div>
                <div><small>Dirección</small><strong>{intake.address ?? "Según gestión"}</strong></div>
                <div><small>Cita</small><strong>{intake.appointment ?? "Según gestión"}</strong></div>
              </div>
              <div className="ai-tools">
                <span className="eyebrow">Herramientas del agente</span>
                {tools.map((tool) => (
                  <div className={`ai-tool ${tool.state}`} key={tool.name}>
                    <span>{tool.state === "done" ? "✓" : tool.state === "running" ? "●" : "○"}</span><p>{tool.name}</p><small>{tool.state === "done" ? "Completado" : tool.state === "running" ? "Ejecutando" : "En espera"}</small>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section className="mvp-dashboard">
          <header className="mvp-header card"><div><span className="eyebrow">Administración</span><h2>Panel del piloto</h2></div><button className="button" onClick={() => setView("chat")} type="button">Abrir Neo IA</button></header>
          <div className="mvp-metrics">
            <article className="card"><span>Total órdenes</span><strong>{metrics.total}</strong></article><article className="card"><span>Creadas hoy</span><strong>{metrics.today}</strong></article><article className="card"><span>Activas</span><strong>{metrics.active}</strong></article><article className="card"><span>Completadas</span><strong>{metrics.completed}</strong></article>
          </div>
          <div className="card mvp-orders">
            <div className="mvp-orders-title"><div><span className="eyebrow">Operación en tiempo real</span><h3>Gestiones registradas</h3></div></div>
            {orders.length === 0 ? <div className="mvp-empty"><h3>Aún no hay gestiones</h3><p>Completa una conversación con Neo IA y aparecerá aquí automáticamente.</p></div> : (
              <div className="mvp-order-list">{orders.map((order) => (
                <article className="mvp-order" key={order.id}>
                  <div className="mvp-order-main"><div><strong>{order.id}</strong><span>{order.customer} · {order.phone}</span><small>{formatRelative(order.createdAt)} · Creada por {order.source}</small></div><div className="order-badges"><span className="priority-pill">{order.priority}</span><span className="mvp-status-pill">{order.status}</span></div></div>
                  <div className="mvp-order-grid"><p><small>Equipo o gestión</small>{order.equipment}</p><p><small>Detalle</small>{order.issue}</p><p><small>Dirección</small>{order.address}</p><p><small>Cita o seguimiento</small>{order.appointment}</p></div>
                  <div className="order-actions"><label className="mvp-status-control">Actualizar estado<select className="input" value={order.status} onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label><div className="quick-actions"><button type="button">Contactar</button><button type="button">Ver detalle</button><button type="button">Asignar responsable</button></div></div>
                </article>
              ))}</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
