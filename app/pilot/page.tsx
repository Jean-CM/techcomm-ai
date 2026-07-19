import Link from "next/link";
import { SmartCommercePilot } from "@/app/components/smart-commerce-pilot";

export default function PilotPage() {
  return (
    <main>
      <nav className="site-nav container">
        <Link className="brand" href="/">Techcomm Smart Commerce</Link>
        <div className="nav-actions">
          <span className="pilot-status">MVP en prueba</span>
          <Link className="button button-small" href="/login">Panel</Link>
        </div>
      </nav>

      <section className="mvp-intro container">
        <div>
          <span className="badge">Primera fase funcional</span>
          <h1>Prueba el flujo de reparación de principio a fin.</h1>
          <p>Conversa como cliente, registra una visita, crea una orden y cambia su estado desde el panel administrativo. Los datos de la prueba quedan guardados en este navegador.</p>
        </div>
        <div className="mvp-intro-checks">
          <span>✓ Conversación guiada</span>
          <span>✓ Creación automática de orden</span>
          <span>✓ Panel operativo</span>
          <span>✓ Cambio de estados</span>
        </div>
      </section>

      <section className="container mvp-section">
        <SmartCommercePilot />
      </section>

      <footer className="container site-footer">
        <strong>Techcomm Smart Commerce</strong>
        <span>MVP funcional de reparaciones, citas y órdenes.</span>
      </footer>
    </main>
  );
}
