import Link from "next/link";
import { requestPasswordReset } from "../login/actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams;

  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px 0" }}>
      <section className="card" style={{ width: "min(440px, 100%)" }}>
        <span className="badge">Techcomm AI</span>
        <h1 style={{ marginBottom: 8 }}>Recuperar contraseña</h1>
        {sent ? (
          <>
            <p className="muted">Si ese correo tiene una cuenta con nosotros, te enviamos un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada (y spam).</p>
            <Link className="button" href="/login" style={{ marginTop: 16, display: "inline-flex" }}>Volver al inicio de sesión</Link>
          </>
        ) : (
          <>
            <p className="muted">Ingresa tu correo y te mandamos un enlace para crear una contraseña nueva.</p>
            {error ? <p style={{ color: "#ff9b9b" }}>{error}</p> : null}
            <form action={requestPasswordReset} className="grid" style={{ marginTop: 24 }}>
              <label>
                <span className="muted">Correo</span>
                <input className="input" type="email" name="email" autoComplete="email" required />
              </label>
              <button className="button" type="submit">Enviar enlace</button>
            </form>
            <Link className="muted" href="/login" style={{ display: "inline-block", marginTop: 16, fontSize: 14 }}>← Volver al inicio de sesión</Link>
          </>
        )}
      </section>
    </main>
  );
}
