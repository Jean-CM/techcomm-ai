import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import AuditSearch from "./audit-search";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

export default async function AuditPage() {
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

  return (
    <main className="container" style={{ padding: "32px 0 72px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 32 }}>
        <div>
          <span className="badge">Super Admin / Admin</span>
          <h1 style={{ marginBottom: 4 }}>Auditoría de llamadas</h1>
          <p className="muted" style={{ margin: 0 }}>
            Busca grabaciones por fecha, teléfono, cédula o cliente — para responder a solicitudes de INDOTEL u otra entidad reguladora.
          </p>
        </div>
        <Link className="button" href="/admin">Volver a Super Admin</Link>
      </header>

      <AuditSearch />
    </main>
  );
}
