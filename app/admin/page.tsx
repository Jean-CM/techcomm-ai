import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import InviteUserForm from "./invite-user-form";
import UsersTable from "./users-table";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

export default async function AdminPage() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();

  const { data: membership } = await admin
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role)) {
    redirect("/dashboard");
  }

  const [{ data: runs }, { data: memberships }, { data: flaggedCalls }] = await Promise.all([
    admin
      .from("ai_agent_runs")
      .select("channel,status,input_tokens,output_tokens,llm_cost_usd,tts_cost_usd,telephony_cost_usd,total_cost_usd,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("organization_memberships")
      .select("user_id,role,status,created_at")
      .eq("organization_id", DEFAULT_ORG_ID),
    admin.rpc("get_high_friction_calls")
  ]);

  const allRuns = runs ?? [];
  const byChannel = (channel: string) => allRuns.filter((r) => r.channel === channel);
  const sum = (rows: typeof allRuns, key: "total_cost_usd") =>
    rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

  const textRuns = byChannel("whatsapp").concat(byChannel("web"));
  const voiceRuns = byChannel("voice");
  const totalCost = sum(allRuns, "total_cost_usd");
  const successCount = allRuns.filter((r) => r.status === "success").length;
  const escalatedCount = allRuns.filter((r) => r.status === "escalated_to_human").length;
  const errorCount = allRuns.filter((r) => r.status === "error").length;

  // Resolve emails for members (auth.users isn't exposed via the public API).
  const userIds = (memberships ?? []).map((m) => m.user_id);
  const emailById = new Map<string, string>();
  for (const id of userIds) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data.user?.email) emailById.set(id, data.user.email);
  }

  return (
    <main className="container" style={{ padding: "32px 0 72px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 32 }}>
        <div>
          <span className="badge">Super Admin</span>
          <h1 style={{ marginBottom: 4 }}>Control digital — Techcomm AI</h1>
          <p className="muted" style={{ margin: 0 }}>{user.email} · rol {membership.role}</p>
        </div>
        <Link className="button" href="/dashboard">Volver al panel</Link>
      </header>

      <section className="grid grid-3" style={{ marginBottom: 24 }}>
        <article className="card">
          <p className="muted">Costo total IA (histórico)</p>
          <strong style={{ fontSize: 32 }}>${totalCost.toFixed(4)}</strong>
        </article>
        <article className="card">
          <p className="muted">Corridas registradas</p>
          <strong style={{ fontSize: 32 }}>{allRuns.length}</strong>
        </article>
        <article className="card">
          <p className="muted">Éxito / Escalado / Error</p>
          <strong style={{ fontSize: 24 }}>{successCount} / {escalatedCount} / {errorCount}</strong>
        </article>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Costo por canal</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Canal</th>
              <th>Corridas</th>
              <th>Tokens entrada</th>
              <th>Tokens salida</th>
              <th>Costo total</th>
              <th>Costo promedio / corrida</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Texto (WhatsApp + Web)</td>
              <td>{textRuns.length}</td>
              <td>{textRuns.reduce((a, r) => a + (r.input_tokens ?? 0), 0)}</td>
              <td>{textRuns.reduce((a, r) => a + (r.output_tokens ?? 0), 0)}</td>
              <td>${sum(textRuns, "total_cost_usd").toFixed(4)}</td>
              <td>${textRuns.length ? (sum(textRuns, "total_cost_usd") / textRuns.length).toFixed(4) : "0.0000"}</td>
            </tr>
            <tr>
              <td>Voz (ElevenLabs + Twilio)</td>
              <td>{voiceRuns.length}</td>
              <td>—</td>
              <td>—</td>
              <td>${sum(voiceRuns, "total_cost_usd").toFixed(4)}</td>
              <td>${voiceRuns.length ? (sum(voiceRuns, "total_cost_usd") / voiceRuns.length).toFixed(4) : "0.0000"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Llamadas para revisar</h2>
        <p className="muted">Detectadas automáticamente por el puntaje de frustración de ElevenLabs — sin necesidad de escuchar cada audio.</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Fecha</th>
              <th>Teléfono</th>
              <th>Frustración máx.</th>
              <th>Resumen</th>
            </tr>
          </thead>
          <tbody>
            {(flaggedCalls ?? [])
              .filter((c: { max_frustration: number | null }) => (c.max_frustration ?? 0) >= 0.3)
              .sort((a: { max_frustration: number }, b: { max_frustration: number }) => b.max_frustration - a.max_frustration)
              .map((c: { id: string; customer_phone: string; summary: string; max_frustration: number; created_at: string }) => (
                <tr key={c.id}>
                  <td>{new Date(c.created_at).toLocaleString("es-DO")}</td>
                  <td>{c.customer_phone}</td>
                  <td style={{ color: c.max_frustration >= 0.5 ? "crimson" : "darkorange" }}>{c.max_frustration.toFixed(2)}</td>
                  <td>{c.summary}</td>
                </tr>
              ))}
            {(flaggedCalls ?? []).filter((c: { max_frustration: number | null }) => (c.max_frustration ?? 0) >= 0.3).length === 0 && (
              <tr><td colSpan={4} className="muted">Ninguna llamada reciente muestra fricción alta.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Usuarios</h2>
        <UsersTable
          initialMembers={(memberships ?? []).map((m) => ({
            user_id: m.user_id,
            email: emailById.get(m.user_id) ?? m.user_id,
            role: m.role,
            status: m.status,
          }))}
        />
        <InviteUserForm />
      </section>
    </main>
  );
}
