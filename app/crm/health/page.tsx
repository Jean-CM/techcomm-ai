import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Reminder = {
  id: string;
  appointment_id: string;
  status: string;
  scheduled_for: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  last_error?: string | null;
  attempts?: number | null;
};

type Appointment = {
  id: string;
  customer_id?: string | null;
  technician_id?: string | null;
  starts_at: string;
  status: string;
  requires_manual_assignment?: boolean | null;
};

type Order = {
  id: string;
  order_number: string;
  technician_id?: string | null;
  status: string;
};

type CallEvent = {
  id: string;
  status?: string | null;
  customer_phone?: string | null;
  summary?: string | null;
  created_at: string;
};

function localDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function OperationalHealthPage() {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const overdueCutoff = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const [remindersResult, appointmentsResult, ordersResult, callsResult] = await Promise.all([
    supabase
      .from("call_reminders")
      .select("id,appointment_id,status,scheduled_for,customer_name,customer_phone,last_error,attempts")
      .in("status", ["pending", "failed"])
      .order("scheduled_for", { ascending: false })
      .limit(100),
    supabase
      .from("appointments")
      .select("id,customer_id,technician_id,starts_at,status,requires_manual_assignment")
      .not("status", "in", "(completed,cancelled)")
      .order("starts_at", { ascending: true })
      .limit(250),
    supabase
      .from("work_orders")
      .select("id,order_number,technician_id,status")
      .not("status", "in", "(completed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("call_events")
      .select("id,status,customer_phone,summary,created_at")
      .in("status", ["failed", "error"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const reminders = (remindersResult.data ?? []) as Reminder[];
  const appointments = (appointmentsResult.data ?? []) as Appointment[];
  const orders = (ordersResult.data ?? []) as Order[];
  const failedCalls = (callsResult.data ?? []) as CallEvent[];

  const failedReminders = reminders.filter((item) => item.status === "failed");
  const overdueReminders = reminders.filter((item) => item.status === "pending" && item.scheduled_for <= overdueCutoff);
  const unassignedAppointments = appointments.filter((item) => !item.technician_id || item.requires_manual_assignment);
  const unassignedOrders = orders.filter((item) => !item.technician_id);

  const conflictPairs: Array<{ first: Appointment; second: Appointment }> = [];
  const byTechnician = new Map<string, Appointment[]>();
  for (const appointment of appointments) {
    if (!appointment.technician_id) continue;
    const list = byTechnician.get(appointment.technician_id) ?? [];
    list.push(appointment);
    byTechnician.set(appointment.technician_id, list);
  }
  for (const list of byTechnician.values()) {
    const sorted = [...list].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      const currentEnd = new Date(current.starts_at).getTime() + 60 * 60 * 1000;
      if (new Date(next.starts_at).getTime() < currentEnd) conflictPairs.push({ first: current, second: next });
    }
  }

  const alertCount = failedReminders.length + overdueReminders.length + unassignedAppointments.length + failedCalls.length + conflictPairs.length;
  const healthy = alertCount === 0;

  const cardStyle = {
    background: "#111722",
    border: "1px solid #28303d",
    borderRadius: 16,
    padding: 18,
  } as const;

  return (
    <main style={{ minHeight: "100vh", background: "#0a0d12", color: "#f7f7f7", padding: 24, fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22 }}>
          <div>
            <small style={{ color: "#ff8a3d", fontWeight: 800, letterSpacing: ".12em" }}>TECHCOMM OPERATIONS</small>
            <h1 style={{ margin: "7px 0 4px", fontSize: 30 }}>Monitor operativo</h1>
            <p style={{ margin: 0, color: "#aeb7c4" }}>Alertas que requieren revisión sin alterar el flujo actual del CRM.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/crm" style={{ color: "white", border: "1px solid #384252", borderRadius: 10, padding: "10px 14px", textDecoration: "none" }}>Volver al CRM</Link>
            <Link href="/crm/health" style={{ color: "#111", background: "#ff8a3d", borderRadius: 10, padding: "10px 14px", textDecoration: "none", fontWeight: 800 }}>Actualizar</Link>
          </div>
        </header>

        <section style={{ ...cardStyle, marginBottom: 16, borderColor: healthy ? "#285b45" : "#6a4a2b" }}>
          <strong style={{ fontSize: 20 }}>{healthy ? "Operación estable" : `${alertCount} alerta(s) operativa(s)`}</strong>
          <p style={{ margin: "6px 0 0", color: "#aeb7c4" }}>{healthy ? "No se detectan pendientes críticos en este momento." : "Las alertas son informativas; el sistema continúa funcionando mientras se revisan."}</p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
          <article style={cardStyle}><small style={{ color: "#aeb7c4" }}>Recordatorios fallidos</small><strong style={{ display: "block", fontSize: 30, marginTop: 8 }}>{failedReminders.length}</strong></article>
          <article style={cardStyle}><small style={{ color: "#aeb7c4" }}>Recordatorios vencidos</small><strong style={{ display: "block", fontSize: 30, marginTop: 8 }}>{overdueReminders.length}</strong></article>
          <article style={cardStyle}><small style={{ color: "#aeb7c4" }}>Citas sin técnico</small><strong style={{ display: "block", fontSize: 30, marginTop: 8 }}>{unassignedAppointments.length}</strong></article>
          <article style={cardStyle}><small style={{ color: "#aeb7c4" }}>Órdenes sin técnico</small><strong style={{ display: "block", fontSize: 30, marginTop: 8 }}>{unassignedOrders.length}</strong></article>
          <article style={cardStyle}><small style={{ color: "#aeb7c4" }}>Llamadas con error</small><strong style={{ display: "block", fontSize: 30, marginTop: 8 }}>{failedCalls.length}</strong></article>
          <article style={cardStyle}><small style={{ color: "#aeb7c4" }}>Cruces de agenda</small><strong style={{ display: "block", fontSize: 30, marginTop: 8 }}>{conflictPairs.length}</strong></article>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Recordatorios que requieren revisión</h2>
            {[...failedReminders, ...overdueReminders].slice(0, 8).map((item) => (
              <div key={item.id} style={{ borderTop: "1px solid #28303d", padding: "12px 0" }}>
                <strong>{item.customer_name || "Cliente"}</strong>
                <div style={{ color: "#aeb7c4", marginTop: 4 }}>{item.customer_phone || "Sin teléfono"} · {localDate(item.scheduled_for)}</div>
                <small style={{ color: item.status === "failed" ? "#ff9d8f" : "#f0c36a" }}>{item.status === "failed" ? item.last_error || "Falló el intento" : "Pendiente fuera de tiempo"}</small>
              </div>
            ))}
            {!failedReminders.length && !overdueReminders.length && <p style={{ color: "#8bcaa7" }}>Sin recordatorios problemáticos.</p>}
          </article>

          <article style={cardStyle}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Agenda y asignaciones</h2>
            {unassignedAppointments.slice(0, 8).map((item) => (
              <div key={item.id} style={{ borderTop: "1px solid #28303d", padding: "12px 0" }}>
                <strong>Cita sin técnico</strong>
                <div style={{ color: "#aeb7c4", marginTop: 4 }}>{localDate(item.starts_at)}</div>
              </div>
            ))}
            {conflictPairs.slice(0, 5).map((pair) => (
              <div key={`${pair.first.id}-${pair.second.id}`} style={{ borderTop: "1px solid #28303d", padding: "12px 0" }}>
                <strong>Posible cruce de agenda</strong>
                <div style={{ color: "#aeb7c4", marginTop: 4 }}>{localDate(pair.first.starts_at)} y {localDate(pair.second.starts_at)}</div>
              </div>
            ))}
            {!unassignedAppointments.length && !conflictPairs.length && <p style={{ color: "#8bcaa7" }}>Agenda sin alertas detectadas.</p>}
          </article>

          <article style={cardStyle}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Llamadas con error</h2>
            {failedCalls.slice(0, 8).map((item) => (
              <div key={item.id} style={{ borderTop: "1px solid #28303d", padding: "12px 0" }}>
                <strong>{item.customer_phone || "Sin teléfono"}</strong>
                <div style={{ color: "#aeb7c4", marginTop: 4 }}>{localDate(item.created_at)}</div>
                <small style={{ color: "#ff9d8f" }}>{item.summary || item.status || "Error de llamada"}</small>
              </div>
            ))}
            {!failedCalls.length && <p style={{ color: "#8bcaa7" }}>Sin llamadas fallidas registradas.</p>}
          </article>
        </section>
      </div>
    </main>
  );
}
