import OperationsClient from "./operations-client";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

export default async function CrmPage() {
  let canOpenAudit = false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const admin = getSupabaseAdmin();
      const { data: membership } = await admin
        .from("organization_memberships")
        .select("role,status")
        .eq("user_id", user.id)
        .eq("organization_id", DEFAULT_ORG_ID)
        .maybeSingle();

      canOpenAudit = Boolean(
        membership && membership.status === "active" && ["owner", "admin"].includes(membership.role),
      );
    }
  } catch {
    canOpenAudit = false;
  }

  return (
    <>
      <style>{`
        .tcTheme .tc-kpi-grid { gap: 10px; }
        .tcTheme .tc-kpi { gap: 8px; padding: 12px 14px; min-height: 118px; }
        .tcTheme .tc-kpi-value { font-size: 25px; }
        .tcTheme .tc-kpi-icon { width: 29px; height: 29px; border-radius: 8px; }
        .tcTheme .tc-kpi-spark { height: 17px; }
        .tcTheme .tc-kpi-sub { font-size: 11.5px; }
        .tc-inventory-kpis { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
        .tc-kpi-action { display:block; width:100%; padding:0; border:0; background:transparent; color:inherit; text-align:left; cursor:pointer; border-radius:14px; }
        .tc-kpi-action .tc-kpi { height:100%; min-height:108px; }
        .tc-kpi-action.is-active .tc-kpi { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent-soft); }
        .tc-pagination { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:12px 16px; border-top:1px solid var(--border); color:var(--muted); font-size:12.5px; }
        .tc-page-indicator { min-width:90px; text-align:center; color:var(--text-soft); }
        .tc-inventory-table { min-width:1420px; }
        @media (max-width:1400px){ .tc-inventory-kpis{grid-template-columns:repeat(3,minmax(0,1fr));} }
        @media (max-width:900px){ .tc-inventory-kpis{grid-template-columns:repeat(2,minmax(0,1fr));} }
        @media (max-width:640px){ .tcTheme .tc-kpi{min-height:96px;} .tc-inventory-kpis{grid-template-columns:1fr;} }
      `}</style>
      <OperationsClient canOpenAudit={canOpenAudit} />
    </>
  );
}
