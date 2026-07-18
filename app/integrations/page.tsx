import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function IntegrationsPage() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ count: sources }, { count: datasets }, { count: running }] = await Promise.all([
    supabase.from("data_sources").select("id", { count: "exact", head: true }),
    supabase.from("datasets").select("id", { count: "exact", head: true }),
    supabase.from("sync_runs").select("id", { count: "exact", head: true }).in("status", ["queued", "running"])
  ]);

  return (
    <main className="container" style={{ padding: "32px 0 72px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 32 }}>
        <div>
          <span className="badge">Integraciones</span>
          <h1 style={{ marginBottom: 4 }}>Fuentes de datos</h1>
          <p className="muted" style={{ margin: 0 }}>Control de conexiones y sincronizaciones autorizadas.</p>
        </div>
        <Link className="button" href="/dashboard">Volver</Link>
      </header>

      <section className="grid grid-3">
        <article className="card"><p className="muted">Fuentes</p><strong style={{ fontSize: 40 }}>{sources ?? 0}</strong></article>
        <article className="card"><p className="muted">Datasets</p><strong style={{ fontSize: 40 }}>{datasets ?? 0}</strong></article>
        <article className="card"><p className="muted">Procesos activos</p><strong style={{ fontSize: 40 }}>{running ?? 0}</strong></article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Conexión empresarial segura</h2>
        <p className="muted">Techcomm AI recibirá únicamente información autorizada mediante un conector interno, APIs o archivos controlados. Las credenciales no se almacenarán en el navegador ni en las tablas públicas.</p>
      </section>
    </main>
  );
}
