import Link from "next/link";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px 0" }}>
      <section className="card" style={{ width: "min(440px, 100%)" }}>
        <span className="badge">Techcomm AI</span>
        <h1 style={{ marginBottom: 8 }}>Acceso seguro</h1>
        <p className="muted">Ingresa con tu cuenta autorizada para gestionar iniciativas y operaciones.</p>
        {error ? <p style={{ color: "#ff9b9b" }}>{error}</p> : null}
        <form action={signIn} className="grid" style={{ marginTop: 24 }}>
          <label>
            <span className="muted">Correo</span>
            <input className="input" type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            <span className="muted">Contraseña</span>
            <input className="input" type="password" name="password" autoComplete="current-password" minLength={8} required />
          </label>
          <button className="button" type="submit">Entrar</button>
        </form>
        <Link className="muted" href="/forgot-password" style={{ display: "inline-block", marginTop: 14, fontSize: 14 }}>¿Olvidaste tu contraseña?</Link>
      </section>
    </main>
  );
}
