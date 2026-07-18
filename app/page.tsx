import Link from "next/link";
import { WhatsAppFloatingButton, WhatsAppLeadForm } from "@/app/components/whatsapp-lead-form";

const capabilities = [
  ["Datos conectados", "Integra SQL Server, APIs, archivos, OneDrive y fuentes corporativas sin exponer la red interna."],
  ["IA empresarial", "Asistentes especializados responden consultas, resumen información y ayudan a tomar decisiones."],
  ["Automatización", "Convierte tareas manuales, correos, cargas y seguimientos en flujos medibles y auditables."],
  ["WhatsApp inteligente", "Atiende consultas, registra solicitudes, consulta datos autorizados y escala casos a personas."],
  ["Gestión de iniciativas", "Centraliza ideas, responsables, aprobaciones, avances, resultados y evidencias."],
  ["Analítica ejecutiva", "Monitorea KPIs, alertas, productividad, impacto y oportunidades desde un solo panel."]
];

const steps = [
  "Conectamos las fuentes autorizadas de la organización.",
  "Normalizamos y protegemos los datos mediante roles y auditoría.",
  "Activamos dashboards, automatizaciones y asistentes de IA.",
  "Habilitamos WhatsApp para consultas y atención empresarial."];

export default function HomePage() {
  return (
    <main>
      <nav className="site-nav container">
        <Link className="brand" href="/">Techcomm AI</Link>
        <div className="nav-actions">
          <a href="#solucion">Solución</a>
          <a href="#contacto">Contacto</a>
          <Link className="button button-small" href="/login">Acceder</Link>
        </div>
      </nav>

      <section className="hero container">
        <div className="hero-copy">
          <span className="badge">Plataforma empresarial de datos, IA y automatización</span>
          <h1>Convierte información dispersa en decisiones y acciones inteligentes.</h1>
          <p>
            Techcomm AI conecta datos, personas, procesos y canales como WhatsApp en una plataforma segura para gestionar operaciones, iniciativas y consultas en tiempo real.
          </p>
          <div className="hero-actions">
            <a className="button" href="#contacto">Solicitar demostración</a>
            <Link className="button button-secondary" href="/login">Ver plataforma</Link>
          </div>
          <div className="trust-row">
            <span>Seguridad por roles</span>
            <span>Auditoría completa</span>
            <span>Integración gradual</span>
          </div>
        </div>
        <div className="hero-panel card">
          <span className="eyebrow">Vista ejecutiva</span>
          <div className="metric-grid">
            <div><strong>24/7</strong><span>Atención automatizada</span></div>
            <div><strong>1</strong><span>Centro de información</span></div>
            <div><strong>360°</strong><span>Visibilidad operacional</span></div>
            <div><strong>IA</strong><span>Asistencia especializada</span></div>
          </div>
          <div className="signal-list">
            <p><span className="signal-dot" /> Fuentes conectadas y monitoreadas</p>
            <p><span className="signal-dot" /> Consultas atendidas por WhatsApp</p>
            <p><span className="signal-dot" /> Alertas y decisiones centralizadas</p>
          </div>
        </div>
      </section>

      <section id="solucion" className="section container">
        <div className="section-heading">
          <span className="eyebrow">Una plataforma, múltiples capacidades</span>
          <h2>Diseñada para resolver problemas reales de operación.</h2>
          <p>Techcomm AI no reemplaza todo de golpe: se conecta con lo que ya existe y agrega una capa segura de inteligencia, automatización y seguimiento.</p>
        </div>
        <div className="feature-grid">
          {capabilities.map(([title, description]) => (
            <article className="card feature-card" key={title}>
              <h3>{title}</h3>
              <p className="muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-band">
        <div className="container split-section">
          <div>
            <span className="eyebrow">WhatsApp + inteligencia empresarial</span>
            <h2>Las personas consultan en un canal que ya conocen.</h2>
            <p className="muted">El asistente puede recibir preguntas, validar permisos, consultar información autorizada, responder, crear solicitudes y transferir casos a un equipo humano.</p>
          </div>
          <div className="card conversation-card">
            <p className="chat incoming">¿Cómo va la iniciativa de automatización comercial?</p>
            <p className="chat outgoing">La iniciativa está en ejecución, tiene 72% de avance y dos tareas pendientes. ¿Deseas el resumen ejecutivo?</p>
            <p className="chat incoming">Sí, y avisa al responsable.</p>
            <p className="chat outgoing">Resumen preparado y notificación registrada.</p>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-heading">
          <span className="eyebrow">Implementación controlada</span>
          <h2>De la idea a una solución empresarial medible.</h2>
        </div>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <article className="step" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="contacto" className="section container contact-section">
        <div>
          <span className="eyebrow">Conversemos</span>
          <h2>Cuéntanos qué proceso, dato o canal necesitas transformar.</h2>
          <p className="muted">La consulta se enviará por WhatsApp con la información organizada para facilitar la atención y coordinar una demostración.</p>
        </div>
        <div className="card">
          <WhatsAppLeadForm />
        </div>
      </section>

      <footer className="container site-footer">
        <strong>Techcomm AI</strong>
        <span>Datos, automatización e inteligencia empresarial.</span>
      </footer>

      <WhatsAppFloatingButton />
    </main>
  );
}
