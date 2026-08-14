import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import styles from "./executive.module.css";

function money(value: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value || 0);
}
function pct(value: number) { return `${Math.round(value * 100)}%`; }
function delta(current: number, previous: number) {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / previous;
}
function dateKey(value: string) { return new Date(value).toISOString().slice(0, 10); }

export default async function ExecutivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("organization_id,role,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership || !["owner", "admin", "manager"].includes(String(membership.role))) redirect("/crm");
  const org = membership.organization_id as string;

  const now = new Date();
  const start30 = new Date(now); start30.setDate(now.getDate() - 30);
  const prevStart = new Date(start30); prevStart.setDate(start30.getDate() - 30);
  const start14 = new Date(now); start14.setDate(now.getDate() - 13);

  const [ordersRes, quotesRes, paymentsRes, callsRes, approvalsRes, followupsRes, productsRes] = await Promise.all([
    admin.from("work_orders").select("id,status,service_line,service_category,brand,created_at,updated_at").eq("organization_id", org).gte("created_at", prevStart.toISOString()).order("created_at", { ascending: true }),
    admin.from("quotes").select("id,status,total,created_at,accepted_at").eq("organization_id", org).gte("created_at", prevStart.toISOString()),
    admin.from("payments").select("id,amount,created_at").eq("organization_id", org).gte("created_at", prevStart.toISOString()),
    admin.from("call_events").select("id,event_type,status,created_at").eq("organization_id", org).gte("created_at", prevStart.toISOString()),
    admin.from("approval_decisions").select("id,work_order_id,approval_result,supervisor_required,created_at").eq("organization_id", org).gte("created_at", prevStart.toISOString()).order("created_at", { ascending: true }),
    admin.from("approval_followups").select("id,status,scheduled_for,supervisor_required,created_at").eq("organization_id", org),
    admin.from("products").select("id,active,available_stock,min_stock,inventory_status").eq("organization_id", org).eq("active", true),
  ]);

  const orders = ordersRes.data ?? [];
  const quotes = quotesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const calls = callsRes.data ?? [];
  const approvals = approvalsRes.data ?? [];
  const followups = followupsRes.data ?? [];
  const products = productsRes.data ?? [];

  const isCurrent = (v: string) => new Date(v) >= start30;
  const isPrevious = (v: string) => new Date(v) >= prevStart && new Date(v) < start30;
  const currentOrders = orders.filter(x => isCurrent(x.created_at));
  const previousOrders = orders.filter(x => isPrevious(x.created_at));
  const currentQuotes = quotes.filter(x => isCurrent(x.created_at));
  const previousQuotes = quotes.filter(x => isPrevious(x.created_at));
  const currentPayments = payments.filter(x => isCurrent(x.created_at));
  const previousPayments = payments.filter(x => isPrevious(x.created_at));
  const currentCalls = calls.filter(x => isCurrent(x.created_at) && x.event_type === "post_call_transcription");
  const previousCalls = calls.filter(x => isPrevious(x.created_at) && x.event_type === "post_call_transcription");

  const latestApproval = new Map<string, (typeof approvals)[number]>();
  for (const item of approvals) latestApproval.set(item.work_order_id, item);
  const currentApprovalRows = [...latestApproval.values()].filter(x => isCurrent(x.created_at));
  const approved = currentApprovalRows.filter(x => x.approval_result === "aprobado").length;
  const rejected = currentApprovalRows.filter(x => x.approval_result === "rechazado").length;
  const pending = currentApprovalRows.filter(x => x.approval_result === "pendiente").length;
  const decided = approved + rejected;
  const approvalRate = decided ? approved / decided : 0;

  const quoted = currentQuotes.reduce((s, x) => s + Number(x.total || 0), 0);
  const prevQuoted = previousQuotes.reduce((s, x) => s + Number(x.total || 0), 0);
  const acceptedValue = currentQuotes.filter(x => ["accepted", "approved"].includes(String(x.status))).reduce((s, x) => s + Number(x.total || 0), 0);
  const collected = currentPayments.reduce((s, x) => s + Number(x.amount || 0), 0);
  const prevCollected = previousPayments.reduce((s, x) => s + Number(x.amount || 0), 0);
  const activeOrders = currentOrders.filter(x => !["completed", "cancelled", "devuelto_cliente"].includes(String(x.status))).length;
  const completedOrders = currentOrders.filter(x => x.status === "completed").length;
  const pendingFollowups = followups.filter(x => x.status === "pending" && new Date(x.scheduled_for) >= new Date(now.getTime() - 24 * 3600 * 1000)).length;
  const criticalStock = products.filter(x => x.inventory_status === "out" || Number(x.available_stock ?? 0) <= Number(x.min_stock ?? 0)).length;

  const days: { key: string; label: string; total: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start14); d.setDate(start14.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: d.toLocaleDateString("es-DO", { day: "2-digit", month: "short" }), total: 0 });
  }
  for (const order of currentOrders) {
    const day = days.find(d => d.key === dateKey(order.created_at));
    if (day) day.total++;
  }
  const maxDay = Math.max(1, ...days.map(d => d.total));

  const lines = new Map<string, number>();
  currentOrders.forEach(o => lines.set(o.service_line || "general", (lines.get(o.service_line || "general") || 0) + 1));
  const lineRows = [...lines.entries()].sort((a,b) => b[1]-a[1]);
  const maxLine = Math.max(1, ...lineRows.map(([,v]) => v));

  const kpis = [
    { label: "Ingresos cobrados", value: money(collected), change: delta(collected, prevCollected), note: "Pagos registrados · últimos 30 días" },
    { label: "Monto cotizado", value: money(quoted), change: delta(quoted, prevQuoted), note: `${currentQuotes.length} cotizaciones emitidas` },
    { label: "Valor aprobado", value: money(acceptedValue), change: quoted ? acceptedValue / quoted : 0, note: "Participación del monto cotizado" },
    { label: "Aprobación de presupuestos", value: pct(approvalRate), change: approvalRate, note: `${approved} aprobados · ${rejected} rechazados` },
    { label: "Órdenes nuevas", value: String(currentOrders.length), change: delta(currentOrders.length, previousOrders.length), note: `${activeOrders} activas · ${completedOrders} completadas` },
    { label: "Llamadas IA", value: String(currentCalls.length), change: delta(currentCalls.length, previousCalls.length), note: "Conversaciones procesadas" },
  ];

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>TECHCOMM OPERATIONS · VISTA EJECUTIVA</div>
        <h1>El negocio, sin ruido.</h1>
        <p>Resumen de los últimos 30 días para dirección, socios y toma de decisiones.</p>
      </div>
      <div className={styles.actions}>
        <span className={styles.period}>Últimos 30 días</span>
        <Link className={styles.back} href="/crm">Volver al CRM</Link>
      </div>
    </header>

    <section className={styles.kpiGrid}>
      {kpis.map((kpi) => <article className={styles.kpi} key={kpi.label}>
        <span>{kpi.label}</span>
        <strong>{kpi.value}</strong>
        <div className={kpi.change >= 0 ? styles.positive : styles.negative}>
          {kpi.change >= 0 ? "↑" : "↓"} {Math.abs(Math.round(kpi.change * 100))}%
        </div>
        <small>{kpi.note}</small>
      </article>)}
    </section>

    <section className={styles.gridTwo}>
      <article className={styles.panel}>
        <div className={styles.panelHead}><div><span>Actividad</span><h2>Órdenes por día</h2></div><b>14 días</b></div>
        <div className={styles.chart}>
          {days.map(day => <div className={styles.barCol} key={day.key} title={`${day.label}: ${day.total}`}>
            <div className={styles.barTrack}><div className={styles.bar} style={{ height: `${Math.max(day.total ? 8 : 2, (day.total / maxDay) * 100)}%` }} /></div>
            <small>{day.label}</small>
          </div>)}
        </div>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHead}><div><span>Call Center IA</span><h2>Decisiones de presupuesto</h2></div><b>{currentApprovalRows.length} gestiones</b></div>
        <div className={styles.approvalWrap}>
          <div className={styles.donut} style={{ background: `conic-gradient(#0f766e 0 ${approvalRate*100}%, #dc2626 ${approvalRate*100}% ${decided ? 100 : 0}%, #e5e7eb ${decided ? 100 : 0}% 100%)` }}><div><strong>{pct(approvalRate)}</strong><span>aprobación</span></div></div>
          <div className={styles.legend}>
            <div><i className={styles.goodDot}/><span>Aprobados</span><b>{approved}</b></div>
            <div><i className={styles.badDot}/><span>Rechazados</span><b>{rejected}</b></div>
            <div><i className={styles.waitDot}/><span>Pendientes</span><b>{pending}</b></div>
            <div><i className={styles.warnDot}/><span>Seguimientos abiertos</span><b>{pendingFollowups}</b></div>
          </div>
        </div>
      </article>
    </section>

    <section className={styles.gridTwo}>
      <article className={styles.panel}>
        <div className={styles.panelHead}><div><span>Mix operativo</span><h2>Órdenes por línea de servicio</h2></div></div>
        <div className={styles.hBars}>
          {lineRows.length ? lineRows.map(([name, value]) => <div className={styles.hRow} key={name}>
            <div><span>{name.replaceAll("_", " ")}</span><b>{value}</b></div>
            <div className={styles.hTrack}><div style={{ width: `${(value/maxLine)*100}%` }}/></div>
          </div>) : <p className={styles.empty}>Aún no hay órdenes en el período.</p>}
        </div>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHead}><div><span>Radar ejecutivo</span><h2>Lo que necesita atención</h2></div></div>
        <div className={styles.radar}>
          <div><span>Seguimientos pendientes</span><strong>{pendingFollowups}</strong><small>Clientes que esperan nuevo contacto</small></div>
          <div><span>Inventario crítico</span><strong>{criticalStock}</strong><small>SKU agotados o en/bajo mínimo</small></div>
          <div><span>Órdenes activas</span><strong>{activeOrders}</strong><small>Casos todavía en proceso</small></div>
          <div><span>Supervisor requerido</span><strong>{currentApprovalRows.filter(x => x.supervisor_required).length}</strong><small>Excepciones, descuentos o escalamiento</small></div>
        </div>
      </article>
    </section>

    <footer className={styles.footer}>
      <span>Datos en tiempo real desde Techcomm Operations.</span>
      <span>Actualizado {now.toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}</span>
    </footer>
  </main>;
}
