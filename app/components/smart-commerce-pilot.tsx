"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Message = { role: "customer" | "assistant"; text: string };
type OrderStatus = "Pendiente" | "Confirmada" | "Técnico en camino" | "En diagnóstico" | "Completada";
type Intent = "repair" | "quote" | "status" | "general" | "unknown";
type Step =
  | "need"
  | "technical_brand"
  | "technical_model"
  | "technical_details"
  | "quote_details"
  | "customer"
  | "phone"
  | "address"
  | "appointment"
  | "confirm"
  | "status_id"
  | "general_followup"
  | "complete";
type ToolState = "idle" | "running" | "done";

type WorkOrder = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  equipment: string;
  brand: string;
  model: string;
  issue: string;
  technicalNotes: string;
  possibleCauses: string;
  appointment: string;
  status: OrderStatus;
  createdAt: string;
  priority: "Normal" | "Urgente";
  source: "Techcomm AI";
};

type Intake = Partial<Omit<WorkOrder, "id" | "status" | "createdAt" | "priority" | "source">>;

const initialMessages: Message[] = [{
  role: "assistant",
  text: "¡Hola! Soy el asistente virtual de Techcomm. ¿En qué puedo ayudarte hoy?"
}];

const suggestions = [
  "Mi televisor tiene una mancha negra",
  "Quiero cotizar un celular",
  "Necesito una visita técnica",
  "Quiero consultar mi orden"
];

const statusOptions: OrderStatus[] = ["Pendiente", "Confirmada", "Técnico en camino", "En diagnóstico", "Completada"];

function detectIntent(text: string): Intent {
  const value = text.toLowerCase();
  if (/estado|seguimiento|orden|solicitud|técnico en camino|tecnico en camino/.test(value)) return "status";
  if (/precio|cotiz|comprar|disponib|venden|tienen|producto|modelo|busco/.test(value)) return "quote";
  if (/dañ|dano|falla|problema|no enciende|no enfría|no enfria|ruido|repar|avería|averia|visita|pantalla negra|mancha negra|línea negra|linea negra|se ve negro|no se ve|parpadea|golpe/.test(value)) return "repair";
  if (/hola|buenas|horario|ubicación|ubicacion|servicio|información|informacion|pregunta|consulta/.test(value)) return "general";
  return "unknown";
}

function splitNeed(text: string) {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();
  const equipmentWords = ["televisor", "tv", "nevera", "lavadora", "aire acondicionado", "celular", "computadora", "laptop", "microondas", "estufa", "secadora", "tablet"];
  const found = equipmentWords.find((word) => lower.includes(word));
  const equipment = found === "tv" ? "Televisor" : found ? found.charAt(0).toUpperCase() + found.slice(1) : "Equipo por identificar";
  return { equipment, issue: normalized };
}

function possibleCausesFor(equipment: string, issue: string) {
  const text = `${equipment} ${issue}`.toLowerCase();
  if (/televisor|tv/.test(text) && /negra|negro|línea|linea|mancha|pantalla/.test(text)) {
    return "Posible falla de panel, tarjeta T-CON, flex de pantalla o retroiluminación. Requiere diagnóstico presencial.";
  }
  if (/nevera/.test(text) && /no enfría|no enfria/.test(text)) {
    return "Posible problema de ventilación, termostato, sistema de deshielo o refrigerante. Requiere evaluación técnica.";
  }
  if (/lavadora/.test(text) && /ruido|centrifuga|centrífuga/.test(text)) {
    return "Posible desgaste de rodamientos, desbalance, suspensión o motor. Requiere revisión técnica.";
  }
  return "La causa exacta se confirmará durante la evaluación técnica; no se realizará ninguna reparación sin autorización.";
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
  const [voiceActive, setVoiceActive] = useState(false);
  const [listening, setListening] = useState(false);

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

  const confidence = step === "need" ? 24 : ["technical_brand", "technical_model", "technical_details"].includes(step) ? 64 : step === "customer" ? 74 : step === "phone" ? 82 : step === "address" ? 88 : step === "appointment" ? 94 : 99;

  const tools = useMemo(() => {
    const state = (done: boolean, active: boolean): ToolState => done ? "done" : active ? "running" : "idle";
    return [
      { name: "Comprender la necesidad", state: state(intent !== "unknown", step === "need") },
      { name: "Preparar diagnóstico", state: state(Boolean(intake.technicalNotes), ["technical_brand", "technical_model", "technical_details"].includes(step)) },
      { name: "Identificar al cliente", state: state(Boolean(intake.customer), step === "customer") },
      { name: "Validar teléfono", state: state(Boolean(intake.phone), step === "phone") },
      { name: "Coordinar visita", state: state(Boolean(intake.appointment), ["address", "appointment"].includes(step)) },
      { name: "Registrar orden", state: state(step === "complete", step === "confirm") }
    ];
  }, [intake, intent, step]);

  function speak(text: string) {
    if (!voiceActive || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-DO";
    utterance.rate = 0.96;
    window.speechSynthesis.speak(utterance);
  }

  function addAssistant(text: string) {
    setMessages((current) => [...current, { role: "assistant", text }]);
    speak(text);
  }

  function startListening() {
    const browserWindow = window as typeof window & { webkitSpeechRecognition?: new () => any; SpeechRecognition?: new () => any };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      addAssistant("Este navegador no permite reconocimiento de voz. Puedes continuar escribiendo o probar desde Chrome o Edge.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "es-DO";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      setInput(transcript);
    };
    recognition.start();
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
        if (/^(hola|buenas|buen día|buen dia|hey)$/i.test(value)) {
          addAssistant("¡Bienvenido! Será un gusto ayudarte. Cuéntame qué necesitas y te orientaré paso a paso.");
          setThinking(false);
          return;
        }

        const detected = detectIntent(value);
        setIntent(detected);

        if (detected === "repair") {
          const need = splitNeed(value);
          setIntake((current) => ({ ...current, ...need, possibleCauses: possibleCausesFor(need.equipment, need.issue) }));
          setStep("technical_brand");
          addAssistant(`Entiendo. Ya identifiqué una posible avería en tu ${need.equipment.toLowerCase()}. Para preparar mejor la revisión, ¿qué marca es el equipo?`);
        } else if (detected === "quote") {
          setIntake((current) => ({ ...current, issue: value }));
          setStep("quote_details");
          addAssistant("Claro. ¿Qué producto o modelo buscas y qué características son importantes para ti?");
        } else if (detected === "status") {
          setStep("status_id");
          addAssistant("Con gusto. Escríbeme el número de orden o el teléfono registrado.");
        } else if (detected === "general") {
          setStep("general_followup");
          addAssistant("Claro, cuéntame un poco más para orientarte correctamente.");
        } else {
          addAssistant("Entiendo. Cuéntame un poco más sobre lo que ocurre o lo que estás buscando.");
        }
        setThinking(false);
        return;
      }

      if (step === "technical_brand") {
        setIntake((current) => ({ ...current, brand: value }));
        setStep("technical_model");
        addAssistant(`Perfecto, es un equipo ${value}. ¿Conoces el modelo? Si no lo tienes a mano, escribe “no sé” y continuamos.`);
        setThinking(false);
        return;
      }

      if (step === "technical_model") {
        setIntake((current) => ({ ...current, model: value }));
        setStep("technical_details");
        addAssistant("Gracias. Para orientar al técnico: ¿el problema apareció de repente, el equipo recibió algún golpe y enciende normalmente?");
        setThinking(false);
        return;
      }

      if (step === "technical_details") {
        const notes = value;
        setIntake((current) => ({ ...current, technicalNotes: notes }));
        setStep("customer");
        addAssistant(`Gracias, ya tengo una descripción útil para el técnico. ${intake.possibleCauses ?? "La causa exacta se confirmará durante la evaluación."} No realizaremos ninguna reparación sin informarte el diagnóstico y el costo. ¿A nombre de quién preparo la solicitud?`);
        setThinking(false);
        return;
      }

      if (step === "quote_details") {
        setIntake((current) => ({ ...current, equipment: value, issue: `${current.issue ?? "Consulta comercial"}. Preferencias: ${value}` }));
        setStep("customer");
        addAssistant("Perfecto. Puedo dejar la solicitud preparada para que el equipo comercial confirme disponibilidad y precio. ¿Cuál es tu nombre completo?");
        setThinking(false);
        return;
      }

      if (step === "status_id") {
        const phone = normalizeDominicanPhone(value);
        const orderId = value.toUpperCase().match(/OT-?\d+/)?.[0]?.replace("OT", "OT-");
        const found = orderId ? orders.find((order) => order.id === orderId) : phone ? orders.find((order) => order.phone === phone) : undefined;
        addAssistant(found
          ? `Encontré la orden ${found.id}. Actualmente está en estado “${found.status}” y la visita registrada es ${found.appointment}.`
          : "No encontré una orden con ese dato. Verifica el número o el teléfono registrado.");
        setThinking(false);
        return;
      }

      if (step === "general_followup") {
        const redirected = detectIntent(value);
        if (["repair", "quote", "status"].includes(redirected)) {
          setIntent(redirected);
          setStep("need");
          setThinking(false);
          setInput(value);
          addAssistant("Entendido. Pulsa enviar nuevamente y comenzaré esa gestión.");
        } else {
          setIntent("general");
          setIntake((current) => ({ ...current, issue: value, equipment: "Consulta general" }));
          setStep("customer");
          addAssistant("Gracias por explicarlo. ¿Cuál es tu nombre completo para registrar la consulta y darle seguimiento?");
          setThinking(false);
        }
        return;
      }

      if (step === "customer") {
        if (value.trim().split(/\s+/).length < 2) {
          addAssistant("Para identificar correctamente la gestión, escríbeme tu nombre y apellido, por favor.");
        } else {
          setIntake((current) => ({ ...current, customer: value }));
          setStep("phone");
          addAssistant(`Gracias, ${value}. ¿Cuál es el teléfono donde podemos contactarte?`);
        }
        setThinking(false);
        return;
      }

      if (step === "phone") {
        const phone = normalizeDominicanPhone(value);
        if (!phone) {
          addAssistant("Ese teléfono no parece válido. Debe tener 10 dígitos y comenzar con 809, 829 o 849. Por ejemplo: 829-555-1234.");
          setThinking(false);
          return;
        }
        setIntake((current) => ({ ...current, phone }));
        if (intent === "repair") {
          setStep("address");
          addAssistant(`Perfecto, validé el número ${phone}. ¿En qué dirección o sector se encuentra el equipo?`);
        } else {
          setStep("confirm");
          addAssistant(`Listo, validé el número ${phone}. Escribe “confirmar” para registrar la gestión.`);
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
          addAssistant("Gracias. ¿Qué día y rango de horario te convienen para recibir al técnico?");
        }
        setThinking(false);
        return;
      }

      if (step === "appointment") {
        setIntake((current) => ({ ...current, appointment: value }));
        setStep("confirm");
        addAssistant(`Perfecto. Tengo registrado: ${intake.equipment ?? "equipo"} ${intake.brand ?? ""} ${intake.model ?? ""}, falla “${intake.issue ?? "por confirmar"}”, visita en ${intake.address ?? "la dirección indicada"}, horario ${value} y contacto ${intake.phone}. La evaluación tiene un costo referencial de RD$750. Escribe “confirmar” para crear la cita y la orden.`);
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
          brand: intake.brand ?? "No indicada",
          model: intake.model ?? "No indicado",
          issue: intake.issue ?? "Sin detalle",
          technicalNotes: intake.technicalNotes ?? "Sin observaciones",
          possibleCauses: intake.possibleCauses ?? "Pendiente de diagnóstico",
          appointment: intake.appointment ?? (intent === "repair" ? "Por coordinar" : "Seguimiento comercial"),
          status: intent === "repair" ? "Confirmada" : "Pendiente",
          createdAt: new Date().toISOString(),
          priority: "Normal",
          source: "Techcomm AI"
        };
        setOrders((current) => [order, ...current]);
        setStep("complete");
        addAssistant(`Listo, ${order.customer}. Registré la gestión con el número ${order.id}. El técnico recibirá la descripción, marca, modelo y observaciones antes de la visita.`);
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
        <button className={`mvp-nav ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")} type="button">Asistente virtual</button>
        <button className={`mvp-nav ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")} type="button">Panel administrativo <span>{orders.length}</span></button>
        <button className="mvp-nav" onClick={restart} type="button">Nueva conversación</button>
        <div className="mvp-live"><span className="signal-dot" /> Agente operativo</div>
      </aside>

      {view === "chat" ? (
        <section className="ai-command-center">
          <header className="mvp-header card ai-topbar">
            <div><span className="eyebrow">Atención digital activa</span><h2>Techcomm AI</h2></div>
            <div className="ai-health"><span className="signal-dot" /> Sistema listo · chat y voz</div>
          </header>
          <div className="ai-grid">
            <section className="mvp-workspace card">
              <div className="ai-chat-head">
                <div className="ai-avatar">T</div>
                <div><strong>Asistente virtual</strong><span>Consultas, ventas, diagnóstico inicial y servicio técnico</span></div>
                <span className="pilot-status">En línea</span>
              </div>
              <div className="voice-call-bar">
                <button className={`voice-call-button ${voiceActive ? "active" : ""}`} onClick={() => setVoiceActive((current) => !current)} type="button">{voiceActive ? "Finalizar prueba de voz" : "Iniciar prueba de llamada"}</button>
                {voiceActive && <span>Modo voz activo: las respuestas se reproducirán en audio.</span>}
              </div>
              <div className="mvp-chat">
                {messages.map((message, index) => (
                  <div className={`mvp-message ${message.role}`} key={`${message.role}-${index}`}>
                    <small>{message.role === "assistant" ? "Techcomm" : "Cliente"}</small><p>{message.text}</p>
                  </div>
                ))}
                {thinking && <div className="mvp-message assistant ai-thinking"><small>Techcomm</small><p><span /> Analizando la gestión…</p></div>}
              </div>
              {messages.length === 1 && <div className="quick-prompts">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)} type="button">{suggestion}</button>)}</div>}
              <form className="mvp-composer" onSubmit={submitMessage}>
                <input aria-label="Mensaje" className="input" disabled={thinking} onChange={(event) => setInput(event.target.value)} placeholder={step === "confirm" ? "Escribe confirmar o indica qué deseas corregir…" : "Escribe tu consulta o solicitud…"} value={input} />
                {voiceActive && <button className="button button-secondary" onClick={startListening} type="button">{listening ? "Escuchando…" : "Hablar"}</button>}
                <button className="button" disabled={thinking} type="submit">Enviar</button>
              </form>
            </section>

            <aside className="ai-intelligence card">
              <div className="ai-panel-title"><div><span className="eyebrow">Inteligencia en vivo</span><h3>Comprensión de la gestión</h3></div><strong>{confidence}%</strong></div>
              <div className="ai-confidence"><span style={{ width: `${confidence}%` }} /></div>
              <div className="ai-insight"><small>Intención detectada</small><strong>{intentLabel(intent)}</strong></div>
              <div className="ai-data-grid">
                <div><small>Equipo</small><strong>{intake.equipment ?? "Pendiente"}</strong></div>
                <div><small>Marca</small><strong>{intake.brand ?? "Pendiente"}</strong></div>
                <div><small>Modelo</small><strong>{intake.model ?? "Pendiente"}</strong></div>
                <div><small>Cliente</small><strong>{intake.customer ?? "Pendiente"}</strong></div>
                <div><small>Teléfono</small><strong>{intake.phone ?? "Pendiente de validar"}</strong></div>
                <div><small>Cita</small><strong>{intake.appointment ?? "Según gestión"}</strong></div>
              </div>
              {intake.possibleCauses && <div className="ai-insight"><small>Orientación técnica preliminar</small><strong>{intake.possibleCauses}</strong></div>}
              <div className="ai-tools">
                <span className="eyebrow">Agentes y herramientas</span>
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
          <header className="mvp-header card"><div><span className="eyebrow">Administración</span><h2>Panel del piloto</h2></div><button className="button" onClick={() => setView("chat")} type="button">Abrir asistente</button></header>
          <div className="mvp-metrics">
            <article className="card"><span>Total órdenes</span><strong>{metrics.total}</strong></article><article className="card"><span>Creadas hoy</span><strong>{metrics.today}</strong></article><article className="card"><span>Activas</span><strong>{metrics.active}</strong></article><article className="card"><span>Completadas</span><strong>{metrics.completed}</strong></article>
          </div>
          <div className="card mvp-orders">
            <div className="mvp-orders-title"><div><span className="eyebrow">Operación en tiempo real</span><h3>Gestiones registradas</h3></div></div>
            {orders.length === 0 ? <div className="mvp-empty"><h3>Aún no hay gestiones</h3><p>Completa una conversación y aparecerá aquí automáticamente.</p></div> : (
              <div className="mvp-order-list">{orders.map((order) => (
                <article className="mvp-order" key={order.id}>
                  <div className="mvp-order-main"><div><strong>{order.id}</strong><span>{order.customer} · {order.phone}</span><small>{formatRelative(order.createdAt)} · Creada por {order.source}</small></div><div className="order-badges"><span className="priority-pill">{order.priority}</span><span className="mvp-status-pill">{order.status}</span></div></div>
                  <div className="mvp-order-grid"><p><small>Equipo</small>{order.equipment} · {order.brand} · {order.model}</p><p><small>Falla reportada</small>{order.issue}</p><p><small>Observaciones técnicas</small>{order.technicalNotes}</p><p><small>Cita</small>{order.appointment}</p></div>
                  <div className="diagnostic-note"><strong>Orientación preliminar</strong><span>{order.possibleCauses}</span></div>
                  <div className="order-actions"><label className="mvp-status-control">Actualizar estado<select className="input" value={order.status} onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label><div className="quick-actions"><button type="button">Contactar</button><button type="button">Ver detalle</button><button type="button">Asignar técnico</button></div></div>
                </article>
              ))}</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
