import { updatePassword } from "../login/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px 0" }}>
      <section className="card" style={{ width: "min(440px, 100%)" }}>
        <span className="badge">Techcomm AI</span>
        <h1 style={{ marginBottom: 8 }}>Crea una contraseña nueva</h1>
        <p className="muted">Elige una contraseña que no hayas usado antes en esta cuenta.</p>
        {error ? <p style={{ color: "#ff9b9b" }}>{error}</p> : null}
        <form action={updatePassword} className="grid" style={{ marginTop: 24 }}>
          <label>
            <span className="muted">Contraseña nueva</span>
            <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            <span className="muted">Confirma la contraseña</span>
            <input className="input" type="password" name="confirm" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="button" type="submit">Guardar contraseña</button>
        </form>
      </section>
    </main>
  );
}
