import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function DashboardPage() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) {
    redirect(
      "/login?error=Supabase%20no%20está%20configurado%20en%20Vercel.%20Agrega%20las%20variables%20de%20entorno%20y%20vuelve%20a%20desplegar."
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ count: initiatives }, { count: active }, { count: completed }] = await Promise.all([
    supabase.from("initiatives").select("id", { count: "exact", head: true }),
    supabase.from("initiatives").select("id", { count: "exact", head: true }).in("status", ["approved", "in_progress", "blocked"]),
    supabase.from("initiatives").select("id", { count: "exact", head: true }).eq("status", "completed")
  ]);

  return (
    <main className="container" style={{ padding: "32px 0 72px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 32 }}>
        <div>
          <span className="badge">Panel ejecutivo</span>
          <h1 style={{ marginBottom: 4 }}>Techcomm AI</h1>
          <p className="muted" style={{ margin: 0 }}>{user.email}</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link className="button" href="/admin">Super Admin</Link>
          <Link className="button" href="/integrations">Integraciones</Link>
          <form action={signOut}><button className="button" type="submit">Cerrar sesión</button></form>
        </div>
      </header>

      <section className="grid grid-3">
        <article className="card"><p className="muted">Iniciativas</p><strong style={{ fontSize: 40 }}>{initiatives ?? 0}</strong></article>
        <article className="card"><p className="muted">En ejecución</p><strong style={{ fontSize: 40 }}>{active ?? 0}</strong></article>
        <article className="card"><p className="muted">Completadas</p><strong style={{ fontSize: 40 }}>{completed ?? 0}</strong></article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Fundación operativa lista</h2>
        <p className="muted">Autenticación, organizaciones, roles, iniciativas, comentarios, historial, notificaciones, auditoría e integraciones están protegidos mediante RLS.</p>
      </section>
    </main>
  );
}
