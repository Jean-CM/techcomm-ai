"use client";

import { useMemo, useState } from "react";

type Scenario = "repair" | "purchase" | "appointment" | "call";

const scenarios: Record<Scenario, { title: string; messages: string[]; result: string }> = {
  repair: {
    title: "Reparación a domicilio",
    messages: [
      "Hola, mi televisor Samsung se quedó sin imagen.",
      "Lamento el inconveniente. Podemos coordinar una visita técnica a tu hogar. La evaluación tiene un costo de RD$750. ¿En qué sector estás y qué horario te conviene mañana?",
      "Estoy en Los Prados y puedo después de las 10:00 a. m.",
      "Tenemos disponibilidad a las 11:30 a. m. ¿Confirmo la visita para mañana?",
      "Sí, confírmala.",
      "Listo. Tu cita SC-1048 quedó confirmada. Recibirás una llamada automática antes de que el técnico salga hacia tu dirección."
    ],
    result: "Cita confirmada, cliente registrado y orden de diagnóstico creada."
  },
  purchase: {
    title: "Cotización de equipos",
    messages: [
      "Necesito un celular Samsung con buena cámara y presupuesto de RD$25,000.",
      "Puedo prepararte opciones dentro de ese presupuesto. ¿Lo necesitas para uso personal, trabajo o creación de contenido?",
      "Para trabajo y fotos.",
      "Te recomiendo comparar tres modelos disponibles. También puedo incluir protector, cargador y garantía extendida en una cotización formal. ¿La envío por WhatsApp o correo?",
      "Por correo.",
      "Perfecto. La solicitud de cotización Q-2081 quedó registrada para revisión comercial."
    ],
    result: "Necesidad calificada y solicitud de cotización enviada al equipo comercial."
  },
  appointment: {
    title: "Agenda y confirmación",
    messages: [
      "Quiero revisar una lavadora que está haciendo mucho ruido.",
      "Podemos enviar un técnico para diagnóstico. Trabajamos de 9:00 a. m. a 5:00 p. m. ¿Prefieres mañana o el próximo día laborable?",
      "Mañana a primera hora.",
      "Tengo disponible 9:30 a. m. La visita cuesta RD$500. Si el equipo debe trasladarse, recibirás una cotización antes de autorizar la reparación. ¿Confirmas?",
      "Confirmo.",
      "Cita agendada. Te enviaremos recordatorio por mensaje y realizaremos una llamada de confirmación."
    ],
    result: "Agenda reservada y flujo de recordatorio activado."
  },
  call: {
    title: "Atención telefónica con IA",
    messages: [
      "Llamada entrante: cliente consulta por reparación de nevera.",
      "El asistente de voz saluda, identifica la necesidad y recopila marca, avería, dirección y disponibilidad.",
      "El cliente solicita una visita para el martes.",
      "El asistente valida el horario, informa el costo de evaluación y confirma verbalmente los datos.",
      "La plataforma registra la cita y envía el resumen por mensaje o correo.",
      "Si el cliente pide hablar con una persona, la llamada se transfiere con el contexto completo."
    ],
    result: "Llamada atendida, cita creada y conversación escalable a un agente humano."
  }
};

export function SmartCommercePilot() {
  const [scenario, setScenario] = useState<Scenario>("repair");
  const [step, setStep] = useState(2);
  const current = scenarios[scenario];
  const visibleMessages = useMemo(() => current.messages.slice(0, step), [current, step]);

  function changeScenario(next: Scenario) {
    setScenario(next);
    setStep(2);
  }

  return (
    <div className="pilot-shell">
      <div className="pilot-sidebar">
        <span className="eyebrow">Escenarios del piloto</span>
        {(Object.keys(scenarios) as Scenario[]).map((key) => (
          <button
            className={`pilot-scenario ${scenario === key ? "active" : ""}`}
            key={key}
            onClick={() => changeScenario(key)}
            type="button"
          >
            {scenarios[key].title}
          </button>
        ))}
      </div>

      <div className="pilot-console card">
        <div className="pilot-console-header">
          <div>
            <span className="eyebrow">Techcomm Smart Commerce</span>
            <h3>{current.title}</h3>
          </div>
          <span className="pilot-status">Piloto activo</span>
        </div>

        <div className="pilot-messages">
          {visibleMessages.map((message, index) => (
            <p className={`chat ${index % 2 === 0 ? "incoming" : "outgoing"}`} key={`${scenario}-${index}`}>
              {message}
            </p>
          ))}
        </div>

        <div className="pilot-actions">
          <button
            className="button"
            disabled={step >= current.messages.length}
            onClick={() => setStep((value) => Math.min(value + 1, current.messages.length))}
            type="button"
          >
            Continuar conversación
          </button>
          <button className="button button-secondary" onClick={() => setStep(2)} type="button">
            Reiniciar
          </button>
        </div>

        {step >= current.messages.length && <div className="pilot-result">✓ {current.result}</div>}
      </div>
    </div>
  );
}
