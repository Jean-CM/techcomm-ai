import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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
    <main className="tcTheme" style={{ minHeight: "100vh", padding: "24px 22px 72px" }}>
      <div style={{ width: "min(1500px, 100%)", margin: "0 auto" }}>
        <header className="tc-pagehead">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 92, height: 50, borderRadius: 10, background: "#fff", padding: 4, display: "grid", placeItems: "center", overflow: "hidden", border: "1px solid var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/techcomm-logo.svg" alt="Techcomm Wireless" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <span className="tc-pagehead-eyebrow"><ShieldCheck size={14} />Control · Super Admin / Admin</span>
              <h1>Auditoría de llamadas</h1>
              <p>Consulta llamadas por fecha, teléfono, cédula o cliente, revisa su resultado y reproduce la grabación cuando sea necesario.</p>
            </div>
          </div>
          <div className="tc-pagehead-actions">
            <Link className="tc-btn tc-btn-secondary" href="/crm"><ArrowLeft />Volver a Techcomm Operations</Link>
          </div>
        </header>

        <AuditSearch />
      </div>
    </main>
  );
}
