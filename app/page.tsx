import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container" style={{ padding: "96px 0" }}>
      <section style={{ maxWidth: 760 }}>
        <span className="badge">AI Operations Platform</span>
        <h1 style={{ fontSize: "clamp(48px, 8vw, 88px)", lineHeight: .95, margin: "24px 0" }}>Techcomm AI</h1>
        <p className="muted" style={{ fontSize: 20, lineHeight: 1.6 }}>
          Centraliza iniciativas, personas, resultados y automatizaciones en una plataforma empresarial segura.
        </p>
        <Link className="button" href="/login" style={{ marginTop: 24 }}>Acceder a la plataforma</Link>
      </section>
    </main>
  );
}
