import { updatePassword } from "../login/actions";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px 0" }}>
      <section className="card" style={{ width: "min(440px, 100%)" }}>
        <span className="badge">Techcomm AI</span>
        <h1 style={{ marginBottom: 8 }}>Crea tu contraseña</h1>
        <p className="muted">Usa una contraseña corta de 6 a 7 caracteres.</p>
        {error ? <p style={{ color: "#ff9b9b" }}>{error}</p> : null}
        <form action={updatePassword} className="grid" style={{ marginTop: 24 }}>
          <label>
            <span className="muted">Nueva contraseña</span>
            <input className="input" type="password" name="password" autoComplete="new-password" minLength={6} maxLength={7} required />
          </label>
          <label>
            <span className="muted">Confirma la contraseña</span>
            <input className="input" type="password" name="confirm" autoComplete="new-password" minLength={6} maxLength={7} required />
          </label>
          <button className="button" type="submit">Guardar y continuar</button>
        </form>
      </section>
    </main>
  );
}
