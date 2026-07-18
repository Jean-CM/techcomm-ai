import Link from "next/link";
import { SmartCommercePilot } from "@/app/components/smart-commerce-pilot";

const pilotCapabilities = [
  ["Atención 24/7", "Recibe consultas por chat y teléfono fuera del horario laboral sin limitarse a menús rígidos."],
  ["Agenda inteligente", "Consulta disponibilidad, informa el costo de visita, confirma fecha y crea la orden de servicio."],
  ["Cotizaciones", "Recopila necesidades, prepara solicitudes y envía propuestas por mensaje o correo."],
  ["Llamadas con IA", "Atiende llamadas entrantes y realiza llamadas salientes para confirmar citas y dar seguimiento."],
  ["Catálogo independiente", "Opera con su propia base de productos, servicios, precios y disponibilidad sin depender del CRM actual."],
  ["Escalamiento humano", "Transfiere conversaciones o llamadas con el contexto completo cuando se necesita una persona."]
];

export default function PilotPage() {
  return (
    <main>
      <nav className="site-nav container">
        <Link className="brand" href="/">Techcomm Smart Commerce</Link>
        <div className="nav-actions">
          <a href="#demo">Demostración</a>
          <a href="#alcance">Alcance</a>
          <Link className="button button-small" href="/login">Panel</Link>
        </div>
      </nav>

      <section className="pilot-hero container">
        <div>
          <span className="badge">Piloto de atención, ventas y servicios con IA</span>
          <h1>Un asistente que conversa, agenda, cotiza y atiende llamadas.</h1>
          <p>
            Techcomm Smart Commerce funcionará como una plataforma independiente para recibir clientes, coordinar visitas técnicas, preparar cotizaciones y atender llamadas, sin integrarse inicialmente al CRM existente.
          </p>
          <div className="hero-actions">
            <a className="button" href="#demo">Probar escenarios</a>
            <a className="button button-secondary" href="#alcance">Ver alcance del MVP</a>
          </div>
        </div>
        <div className="card pilot-summary">
          <span className="eyebrow">Objetivo del piloto</span>
          <h3>Validar el flujo completo antes de escalar.</h3>
          <p className="muted">Desde la primera consulta hasta la cita, cotización, confirmación telefónica y transferencia a una persona.</p>
          <div className="signal-list">
            <p><span className="signal-dot" /> Plataforma separada del CRM</p>
            <p><span className="signal-dot" /> Chat web y canal de mensajería</p>
            <p><span className="signal-dot" /> Telefonía entrante y saliente</p>
            <p><span className="signal-dot" /> Panel administrativo propio</p>
          </div>
        </div>
      </section>

      <section id="demo" className="section section-band">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Demostración funcional</span>
            <h2>Prueba cómo se comportará el asistente.</h2>
            <p>Estos escenarios representan el flujo inicial del piloto. En la siguiente etapa se conectarán a datos reales, agenda y telefonía.</p>
          </div>
          <SmartCommercePilot />
        </div>
      </section>

      <section id="alcance" className="section container">
        <div className="section-heading">
          <span className="eyebrow">MVP independiente</span>
          <h2>Lo que construiremos primero.</h2>
          <p>El piloto tendrá su propia información operativa y podrá crecer gradualmente sin modificar los sistemas actuales de la empresa.</p>
        </div>
        <div className="feature-grid">
          {pilotCapabilities.map(([title, description]) => (
            <article className="card feature-card" key={title}>
              <h3>{title}</h3>
              <p className="muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="card pilot-roadmap">
          <div>
            <span className="eyebrow">Primera entrega</span>
            <h2>Flujo inicial del piloto</h2>
          </div>
          <div className="steps-grid">
            <article className="step"><span>01</span><p>Cliente escribe o llama y explica libremente su necesidad.</p></article>
            <article className="step"><span>02</span><p>La IA recopila datos, informa costos y consulta disponibilidad.</p></article>
            <article className="step"><span>03</span><p>Se agenda la visita o se registra la solicitud de cotización.</p></article>
            <article className="step"><span>04</span><p>El sistema confirma, recuerda y escala el caso cuando corresponde.</p></article>
          </div>
        </div>
      </section>

      <footer className="container site-footer">
        <strong>Techcomm Smart Commerce</strong>
        <span>Piloto independiente de atención, telefonía, citas y cotizaciones.</span>
      </footer>
    </main>
  );
}
