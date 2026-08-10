import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { signOut } from "../login/actions";

export default async function TechnicianHomePage() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data: technician } = await admin
    .from("technicians")
    .select("id,full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!technician) {
    return (
      <main style={{ minHeight: "100vh", background: "#14181D", color: "#F2EEE6", display: "grid", placeItems: "center", padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p>Tu cuenta no está vinculada a ningún perfil de técnico todavía.</p>
          <p style={{ color: "#9BA1A6", fontSize: 14 }}>Pide a un administrador que te vincule desde el panel de usuarios.</p>
        </div>
      </main>
    );
  }

  const { data: orders } = await admin
    .from("work_orders")
    .select("id,order_number,status,equipment,brand,issue,technician_departed_at,technician_arrived_at,technician_completed_at,customer_id")
    .eq("technician_id", technician.id)
    .neq("status", "completed")
    .order("created_at", { ascending: false });

  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id).filter(Boolean))] as string[];
  const { data: customers } = customerIds.length
    ? await admin.from("customers").select("id,full_name,address,sector").in("id", customerIds)
    : { data: [] };
  const byId = new Map((customers ?? []).map((c) => [c.id, c]));

  return (
    <main style={{ minHeight: "100vh", background: "#14181D", color: "#F2EEE6", fontFamily: "sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <p style={{ color: "#E3B341", fontWeight: 700, fontSize: 13, margin: 0 }}>TECHCOMM WIRELESS</p>
            <h1 style={{ fontSize: 22, margin: "4px 0 0" }}>Hola, {technician.full_name.split(" ")[0]}</h1>
          </div>
          <form action={signOut}>
            <button type="submit" style={{ background: "transparent", border: "1px solid #2C333D", color: "#9BA1A6", borderRadius: 8, padding: "8px 12px" }}>Salir</button>
          </form>
        </div>

        <p style={{ color: "#9BA1A6", fontSize: 14, marginBottom: 12 }}>{(orders ?? []).length} orden{(orders ?? []).length === 1 ? "" : "es"} asignada{(orders ?? []).length === 1 ? "" : "s"}</p>

        {(orders ?? []).length === 0 && (
          <div style={{ background: "#1C2129", borderRadius: 10, padding: 20, textAlign: "center", color: "#9BA1A6" }}>
            No tienes órdenes pendientes por ahora.
          </div>
        )}

        {(orders ?? []).map((o) => {
          const customer = o.customer_id ? byId.get(o.customer_id) : null;
          const stage = o.technician_arrived_at ? "En sitio" : o.technician_departed_at ? "En camino" : "Sin iniciar";
          return (
            <a
              key={o.id}
              href={`/tecnico/orden/${o.id}`}
              style={{ display: "block", background: "#1C2129", borderRadius: 10, padding: 16, marginBottom: 12, textDecoration: "none", color: "inherit", borderLeft: "3px solid #FF6A39" }}
            >
              <p style={{ color: "#E3B341", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>{o.order_number} · {stage}</p>
              <p style={{ margin: "0 0 4px", fontWeight: 700 }}>{o.equipment}{o.brand ? ` — ${o.brand}` : ""}</p>
              <p style={{ margin: "0 0 4px", color: "#9BA1A6", fontSize: 14 }}>{o.issue}</p>
              <p style={{ margin: 0, color: "#9BA1A6", fontSize: 13 }}>{customer?.full_name} — {customer?.address}{customer?.sector ? `, ${customer.sector}` : ""}</p>
            </a>
          );
        })}
      </div>
    </main>
  );
}
